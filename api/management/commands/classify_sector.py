import torch
import pandas as pd
import numpy as np
from django.core.management.base import BaseCommand
from transformers import BertTokenizer, BertForSequenceClassification, Trainer, TrainingArguments
from datasets import Dataset
import evaluate
from api.models import Bill
from sklearn.model_selection import KFold
from tqdm import tqdm


class Command(BaseCommand):
    help = "Train and predict sector classification from Excel data with cross-validation and pseudo-labeling"

    def add_arguments(self, parser):
        parser.add_argument("--excel_path", type=str, required=True, help="Path to the Excel training data")
        parser.add_argument("--num_epochs", type=int, default=3, help="Number of epochs for training")
        parser.add_argument("--kfold", type=int, default=5, help="Number of folds for K-fold cross-validation")
        parser.add_argument("--skip_training", action="store_true", help="Skip training and use existing fine-tuned model")
        parser.add_argument("--predict_only", action="store_true", help="Use final model to predict labels for unlabeled bills in the DB")

    def handle(self, *args, **options):
        tokenizer = BertTokenizer.from_pretrained("monologg/kobert")

        if options["predict_only"]:
            label_names = sorted(set(v for values in sector_classification.values() for v in values))
            label2id = {label: idx for idx, label in enumerate(label_names)}
            id2label = {idx: label for label, idx in label2id.items()}

            model = BertForSequenceClassification.from_pretrained("kobert-pseudo-final", num_labels=len(label_names))
            model.eval()

            bills = Bill.objects.filter(industry_category="").only("id", "name")
            results = []
            for bill in tqdm(bills, desc="Predicting DB bills"):
                inputs = tokenizer(bill.name, return_tensors="pt", truncation=True, padding="max_length", max_length=64)
                with torch.no_grad():
                    logits = model(**inputs).logits
                    probs = torch.nn.functional.softmax(logits, dim=1)
                    pred_id = torch.argmax(probs, dim=1).item()
                    pred_label = id2label[pred_id]
                    results.append((bill.id, pred_label))

            for bill_id, pred_label in results:
                Bill.objects.filter(id=bill_id).update(industry_category=pred_label)

            self.stdout.write(self.style.SUCCESS(f"✅ DB 예측 완료: {len(results)}개 Bill에 대해 예측 결과 저장됨"))
            return

        excel_path = options["excel_path"]
        num_epochs = options["num_epochs"]
        kfold_num = options["kfold"]
        skip_training = options["skip_training"]

        df = pd.read_excel(excel_path)
        if df.shape[1] < 2:
            self.stdout.write(self.style.ERROR("Excel file must have at least two columns"))
            return

        texts = df.iloc[:, 0].astype(str).tolist()
        labels_raw = df.iloc[:, 1].astype(str).tolist()
        label_names = sorted(list(set(labels_raw)))
        label2id = {label: idx for idx, label in enumerate(label_names)}
        id2label = {idx: label for label, idx in label2id.items()}
        labels = [label2id[label] for label in labels_raw]

        self.stdout.write(self.style.SUCCESS(f"Training data: {len(texts)} samples, Labels: {label_names}"))
        self.stdout.write(self.style.NOTICE(f"K-fold cross-validation: {kfold_num} folds, Epochs: {num_epochs}"))

        metric = evaluate.load("accuracy")

        def preprocess_function(examples):
            return tokenizer(examples["text"], truncation=True, padding='max_length', max_length=64)

        all_texts = np.array(texts)
        all_labels = np.array(labels)
        kfold = KFold(n_splits=kfold_num, shuffle=True, random_state=42)

        best_model_path = None
        best_acc = 0

        if not skip_training:
            for fold_idx, (train_idx, val_idx) in enumerate(kfold.split(all_texts)):
                self.stdout.write(self.style.NOTICE(f"==== Fold {fold_idx + 1}/{kfold_num} ===="))

                train_dataset_raw = Dataset.from_dict({
                    "text": all_texts[train_idx].tolist(),
                    "label": all_labels[train_idx].tolist()
                })
                val_dataset_raw = Dataset.from_dict({
                    "text": all_texts[val_idx].tolist(),
                    "label": all_labels[val_idx].tolist()
                })

                train_dataset = train_dataset_raw.map(preprocess_function, batched=True)
                val_dataset = val_dataset_raw.map(preprocess_function, batched=True)
                train_dataset.set_format(type="torch", columns=["input_ids", "attention_mask", "label"])
                val_dataset.set_format(type="torch", columns=["input_ids", "attention_mask", "label"])

                model = BertForSequenceClassification.from_pretrained("monologg/kobert", num_labels=len(label_names))

                training_args = TrainingArguments(
                    output_dir=f"kobert-finetuned-fold{fold_idx + 1}",
                    eval_strategy="epoch",
                    save_strategy="epoch",
                    learning_rate=2e-5,
                    per_device_train_batch_size=8,
                    per_device_eval_batch_size=8,
                    num_train_epochs=num_epochs,
                    weight_decay=0.01,
                    load_best_model_at_end=True,
                    metric_for_best_model="accuracy",
                    greater_is_better=True,
                    save_total_limit=1,
                    use_cpu=not torch.cuda.is_available(),
                )

                trainer = Trainer(
                    model=model,
                    args=training_args,
                    train_dataset=train_dataset,
                    eval_dataset=val_dataset,
                    compute_metrics=lambda p: metric.compute(
                        predictions=torch.argmax(torch.tensor(p.predictions), dim=-1),
                        references=p.label_ids
                    ),
                )

                trainer.train()
                result = trainer.evaluate()
                acc = result.get("eval_accuracy", 0)

                if acc > best_acc:
                    best_acc = acc
                    best_model_path = f"kobert-finetuned-fold{fold_idx + 1}"

        else:
            best_model_path = f"kobert-finetuned-fold1"
            self.stdout.write(self.style.WARNING(f"Training skipped. Using model from: {best_model_path}"))

        self.stdout.write(self.style.SUCCESS(f"Best model: {best_model_path} (Accuracy: {best_acc:.4f})"))
        model = BertForSequenceClassification.from_pretrained(best_model_path, num_labels=len(label_names))

        val_dataset_fixed = Dataset.from_dict({
            "text": all_texts[-100:].tolist(),
            "label": all_labels[-100:].tolist()
        }).map(preprocess_function, batched=True)
        val_dataset_fixed.set_format(type="torch", columns=["input_ids", "attention_mask", "label"])

        pseudo_texts = all_texts[:-100].tolist()

        while True:
            model.eval()
            confident_texts, confident_labels = [], []
            for text in pseudo_texts:
                inputs = tokenizer(text, return_tensors="pt", truncation=True, padding="max_length", max_length=64)
                with torch.no_grad():
                    logits = model(**inputs).logits
                    probs = torch.nn.functional.softmax(logits, dim=1)
                    confidence, pred_id = torch.max(probs, dim=1)
                    if confidence.item() > 0.8:
                        confident_texts.append(text)
                        confident_labels.append(pred_id.item())

            if not confident_texts:
                self.stdout.write(self.style.WARNING("No confident pseudo-labels found. Stopping."))
                break

            pseudo_dataset = Dataset.from_dict({"text": confident_texts, "label": confident_labels})
            pseudo_dataset = pseudo_dataset.map(preprocess_function, batched=True)
            pseudo_dataset.set_format(type="torch", columns=["input_ids", "attention_mask", "label"])

            model = BertForSequenceClassification.from_pretrained(best_model_path, num_labels=len(label_names))

            args = TrainingArguments(
                output_dir="kobert-pseudo-final",
                num_train_epochs=1,
                per_device_train_batch_size=8,
                per_device_eval_batch_size=8,
                eval_strategy="epoch",
                save_strategy="epoch",
                logging_dir="./logs-pseudo",
                use_cpu=not torch.cuda.is_available(),
            )

            trainer = Trainer(
                model=model,
                args=args,
                train_dataset=pseudo_dataset,
                eval_dataset=val_dataset_fixed,
                compute_metrics=lambda p: metric.compute(
                    predictions=torch.argmax(torch.tensor(p.predictions), dim=-1),
                    references=p.label_ids
                )
            )

            trainer.train()
            acc = trainer.evaluate().get("eval_accuracy", 0)
            self.stdout.write(self.style.SUCCESS(f"Pseudo-labeling 재학습 Accuracy: {acc:.4f}"))

            trainer.save_model("kobert-pseudo-final")
            proceed = input("계속 반복 학습하시겠습니까? (y/n): ").strip().lower()
            if proceed != "y":
                break

        self.stdout.write(self.style.SUCCESS("최종 모델이 kobert-pseudo-final 폴더에 저장되었습니다."))
