from django.db import models


class Bill(models.Model):
    AGE = models.TextField(null=True, blank=True)
    BILL_ID = models.TextField(unique=True)  # 유일한 키
    BILL_NO = models.TextField(null=True, blank=True)
    BILL_KND = models.TextField(null=True, blank=True)
    BILL_NM = models.TextField(null=True, blank=True)
    PPSR_NM = models.TextField(null=True, blank=True)
    PPSR_KND = models.TextField(null=True, blank=True)
    PPSR_DT = models.DateField(null=True, blank=True)
    PPSR_SESS = models.IntegerField(null=True, blank=True)

    JRCMIT_NM = models.TextField(null=True, blank=True)
    JRCMIT_CMMT_DT = models.DateField(null=True, blank=True)
    JRCMIT_PRSNT_DT = models.DateField(null=True, blank=True)
    JRCMIT_PROC_DT = models.DateField(null=True, blank=True)
    JRCMIT_PROC_RSL = models.TextField(null=True, blank=True)

    LAW_CMMT_DT = models.DateField(null=True, blank=True)
    LAW_PRSNT_DT = models.DateField(null=True, blank=True)
    LAW_PROC_DT = models.DateField(null=True, blank=True)
    LAW_PROC_RSLT = models.TextField(null=True, blank=True)

    RGS_PRSNT_DT = models.DateField(null=True, blank=True)
    RGS_RSLN_DT = models.DateField(null=True, blank=True)
    RGS_CONF_NM = models.TextField(null=True, blank=True)
    RGS_CONF_RSLT = models.TextField(null=True, blank=True)

    GVRN_TRSF_DT = models.DateField(null=True, blank=True)
    PROM_LAW_NM = models.TextField(null=True, blank=True)
    LAW_SECTOR = models.TextField(null=True, blank=True)
    PROM_DT = models.DateField(null=True, blank=True)
    PROM_NO = models.IntegerField(null=True, blank=True)

    LINK_URL = models.TextField(null=True, blank=True)
    PROC_RSLT = models.TextField(null=True, blank=True)
    SUMMARY = models.TextField(null=True, blank=True)
    COMMENTS = models.JSONField(null=True, blank=True)  # jsonb

    def __str__(self):
        return f"{self.BILL_NM} ({self.BILL_ID})"

