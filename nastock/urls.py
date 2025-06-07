"""
URL configuration for nastock project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/4.2/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.contrib import admin
from django.urls import path, re_path
from django.views.generic import TemplateView
from api.views import BillListView, BillDetailView, add_comment, valid_prom_bills, top7_companies_by_sector, stock_data

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/bills/', BillListView.as_view(), name='bill-list'),
    path('api/bills/<str:BILL_NO>/', BillDetailView.as_view(), name='bill-detail'),
    path('api/bills/<str:bill_id>/comments/', add_comment, name='add-comment'),
    path('api/valid-prom-bills/', valid_prom_bills),
    path('api/companies/', top7_companies_by_sector),
    path('api/stock/', stock_data),
]
