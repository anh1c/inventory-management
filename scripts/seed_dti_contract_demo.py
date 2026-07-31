"""Seed linked DTI demo contracts, orders, POM build, and EEPOS purchasable parts.

Run from repository root:

    /home/anhlc/DTI/env/bin/python src/backend/InvenTree/manage.py shell < scripts/seed_dti_contract_demo.py

The script is idempotent for objects with the DTI-DEMO / DTI-PO.09.03.2026
references used below.
"""

from __future__ import annotations

from datetime import date
from decimal import Decimal

from django.db import transaction
from djmoney.money import Money

from build.models import Build
from build.status_codes import BuildStatus
from common.models import ProjectCode
from company.models import Company, Contact, SupplierPart
from order.models import (
    Contract,
    PurchaseOrder,
    PurchaseOrderLineItem,
    SalesOrder,
    SalesOrderLineItem,
)
from order.status_codes import PurchaseOrderStatus, SalesOrderStatus
from part.models import BomItem, Part, PartCategory
from stock.models import StockLocation, StockLocationType


EXCEL_ITEMS = [
    ('0011022', 'crane profile M, 6.000mm/M型轨道，6000mm', 120, '598.119415384615'),
    ('0011021', 'crane profile M, 5.000mm/M型轨道，5000mm', 42, '498.428023076923'),
    ('0011020', 'crane profile M, 4.000mm/M型轨道，4000mm', 24, '398.752707692308'),
    ('0011011-160', 'crane profile S, 3.000mm', 160, '238.057430769231'),
    ('0011011-51', 'crane profile S, 3.000mm', 51, '238.057430769231'),
    ('0011011-8', 'crane profile S, 3.000mm', 8, '238.057430769231'),
    ('0012069', 'Rigid mounting, 50-150', 850, '65.351084615385'),
    ('0012890', 'Joint set S-XXL', 424, '27.883815384615'),
    ('0012011', 'End stop (fixed), S-L', 225, '1.868138461538'),
    ('0012012', 'End stop (adjustable)', 225, '6.067430769231'),
    ('0012703', 'end cover L', 10, '11.313330769231'),
    ('0012702', 'end cover M', 75, '9.298892307692'),
    ('0012701', 'end cover S', 360, '7.512746153846'),
    ('0021025', 'Hinge-trolley AL 600|600 (incl. bolt)', 445, '190.643369230769'),
    ('0021024', 'Gab-trolley AL 600|600 (incl. bolt)', 164, '190.643369230769'),
    ('0021076', 'Gab-trolley AL 300|300 (incl. bolt)', 160, '124.982000000000'),
    ('0012081', 'safety system profile', 850, '29.020453846154'),
    ('0012192', 'safety system girder', 450, '53.163169230769'),
    ('0022007', 'safety system trolley', 160, '37.200392307692'),
    ('0060239', 'Internal conductor line set SL 6.000 mm', 22, '2334.050907692308'),
    ('0060238', 'Internal conductor line set SL 5.000 mm', 1, '1945.044030769231'),
    ('0060233', 'Internal conductor line set SL 4.000 mm', 3, '1563.088492307692'),
    ('0060222', 'Supply set SL - rail', 5, '738.797315384615'),
    ('0060144', 'Gab trolley AL 600/600 SL', 32, '899.630853846154'),
    ('0031006', 'cabletrolley flatcable', 100, '23.801884615385'),
    ('0031003', 'end fix flatcable', 32, '26.780938461538'),
    ('0012943', 'Crane girder suspension 90 °', 322, '26.649107692308'),
    ('0012009', 'Crane girder suspension 0 °', 112, '17.925769230769'),
]

SERVICE_ITEMS = [
    ('FREIGHT-EXPORT-BOX-WH', 'Cước vận chuyển ra kho đóng thùng', 1, '482.307692307692'),
    ('PACKING-EXPORT-BOX', 'Phí đóng thùng', 1, '2122.153846153846'),
]

SALES_SCOPE = (
    'Cung cấp vật tư, thiết bị, gia công chế tạo, lắp ráp và chạy thử tại '
    'xưởng chế tạo và nhà máy VinFast theo hợp đồng DTT 1.'
)

PURCHASE_SCOPE = (
    'Suspended rail guide assembly Bridge Crane VF/3-7, cấu hình theo báo giá '
    'EEPOS và hợp đồng DTI-PO.09.03.2026.'
)


def upsert_company(name: str, defaults: dict) -> Company:
    company, _ = Company.objects.update_or_create(name=name, defaults=defaults)
    return company


def ensure_contact(company: Company, name: str, role: str, phone: str = '') -> Contact:
    contact, _ = Contact.objects.update_or_create(
        company=company,
        name=name,
        defaults={'role': role, 'phone': phone},
    )
    return contact


def ensure_location(name: str, location_type_name: str, description: str) -> StockLocation:
    location_type, _ = StockLocationType.objects.get_or_create(
        name=location_type_name,
        defaults={'description': description},
    )
    location, _ = StockLocation.objects.get_or_create(
        name=name,
        defaults={'description': description, 'structural': False, 'location_type': location_type},
    )
    if location.location_type_id != location_type.pk:
        location.location_type = location_type
        location.structural = False
        location.save()
    return location


def ensure_part(category: PartCategory, ipn: str, name: str, description: str, **flags) -> Part:
    defaults = {
        'name': name[:100],
        'description': description[:250],
        'category': category,
        'component': flags.get('component', True),
        'assembly': flags.get('assembly', False),
        'purchaseable': flags.get('purchaseable', True),
        'salable': flags.get('salable', False),
        'trackable': flags.get('trackable', False),
        'virtual': flags.get('virtual', False),
        'active': True,
    }
    part = Part.objects.filter(IPN=ipn).first()
    if part:
        for key, value in defaults.items():
            setattr(part, key, value)
        part.save()
    else:
        part = Part.objects.create(IPN=ipn, **defaults)
    return part


def ensure_supplier_part(part: Part, supplier: Company, sku: str, description: str, price: str) -> SupplierPart:
    supplier_part, _ = SupplierPart.objects.update_or_create(
        part=part,
        supplier=supplier,
        SKU=sku,
        defaults={
            'description': description[:250],
            'active': True,
            'base_cost': Decimal(price),
        },
    )
    return supplier_part


def set_contract_orders(contract: Contract, *, sales_orders=None, purchase_orders=None) -> None:
    if sales_orders is not None:
        contract.sales_orders.set(sales_orders)
    if purchase_orders is not None:
        contract.purchase_orders.set(purchase_orders)


def reset_demo_records() -> None:
    old_component_ipns = [f'EEPOS-{sku}' for sku, _name, _qty, _price in EXCEL_ITEMS]
    old_service_ipns = [f'EEPOS-{sku}' for sku, _name, _qty, _price in SERVICE_ITEMS]
    new_component_ipns = [f'EEPOS-XK1-{sku}' for sku, _name, _qty, _price in EXCEL_ITEMS]
    new_service_ipns = [f'EEPOS-XK1-{sku}' for sku, _name, _qty, _price in SERVICE_ITEMS]
    demo_part_ipns = [
        'DTI-DEMO-POM-VF37',
        'DTI-XK1-DEMO-POM-VF37',
        *old_component_ipns,
        *old_service_ipns,
        *new_component_ipns,
        *new_service_ipns,
    ]

    contract_refs = [
        'DTT-SALES-DEMO-2026',
        'DTI-PO.09.03.2026',
        'DTT-XK1-SALES-DEMO-2026',
        'DTI-PO-XK1-DEMO-2026',
    ]
    purchase_order_refs = [
        'PO9001',
        'PO9002',
        'PO9003',
        'PO9004',
        'PO9005',
        'PO9101',
        'PO9102',
        'PO9103',
        'PO9104',
    ]
    sales_order_refs = ['SO9001', 'SO9101']
    build_refs = ['BO9001', 'BO9101']

    Contract.objects.filter(reference__in=contract_refs).delete()
    PurchaseOrder.objects.filter(reference__in=purchase_order_refs).delete()
    SalesOrder.objects.filter(reference__in=sales_order_refs).delete()
    Build.objects.filter(reference__in=build_refs).delete()

    demo_parts = Part.objects.filter(IPN__in=demo_part_ipns)
    SupplierPart.objects.filter(part__in=demo_parts).delete()
    BomItem.objects.filter(part__in=demo_parts).delete()
    demo_parts.delete()


@transaction.atomic
def seed() -> None:
    reset_demo_records()

    project, _ = ProjectCode.objects.update_or_create(
        code='PRJ-DTI-VF37',
        defaults={'description': 'Demo hợp đồng DTT / EEPOS cho Bridge Crane VF/3-7'},
    )

    dti = upsert_company(
        'DUC TRUNG INDUSTRIAL EQUIPMENT JOINT STOCK COMPANY (DTI)',
        {
            'description': 'DTI - bên mua hợp đồng EEPOS và bên bán hợp đồng DTT',
            'phone': '+84 969351089',
            'tax_id': '0110752517',
            'representative': 'MR PHAM TUAN VU',
            'representative_position': 'Đại diện công ty',
            'is_internal': True,
            'is_supplier': False,
            'is_customer': False,
            'is_manufacturer': True,
            'active': True,
            'currency': 'VND',
        },
    )
    dti_purchase_contact = ensure_contact(dti, 'MR PHAM TUAN VU', 'Đại diện ký hợp đồng mua', '+84 969351089')
    dti_sales_contact = ensure_contact(dti, 'Hồ Viết Hoằng', 'Giám đốc')

    narime = upsert_company(
        'Viện Nghiên cứu Cơ khí (NARIME)',
        {
            'description': 'Bên mua trong hợp đồng DTT 1',
            'phone': '024.37920175',
            'tax_id': '0100100110',
            'representative': 'Nguyễn Tiến Dũng',
            'representative_position': 'Phó Viện trưởng',
            'is_customer': True,
            'is_supplier': False,
            'is_internal': False,
            'active': True,
            'currency': 'VND',
        },
    )
    narime_contact = ensure_contact(narime, 'Nguyễn Tiến Dũng', 'Phó Viện trưởng')

    eepos = upsert_company(
        'Shanghai Jinyunjie Technology Co., Ltd.',
        {
            'description': 'EEPOS / Shanghai Jinyunjie - nhà cung cấp Bridge Crane VF/3-7',
            'phone': '021-69567652',
            'representative': 'Yao Lina',
            'representative_position': 'Representative',
            'is_supplier': True,
            'is_manufacturer': True,
            'is_customer': False,
            'is_internal': False,
            'active': True,
            'currency': 'USD',
        },
    )
    eepos_contact = ensure_contact(eepos, 'Yao Lina', 'Representative', '021-69567652')

    default_location = ensure_location('DTI Demo Kho mặc định', 'Kho', 'Kho nhận hàng mặc định cho demo')
    workshop_location = ensure_location('DTI Demo Xưởng lắp ráp', 'Xưởng', 'Xưởng nhận hàng cho demo POM')
    site_location = ensure_location('DTI Demo Công trường VinFast', 'Công trường', 'Công trường nhận hàng demo')

    category, _ = PartCategory.objects.get_or_create(
        name='DTI Demo EEPOS',
        defaults={'description': 'Vật tư demo từ báo giá EEPOS - XK-1'},
    )

    component_supplier_parts = []
    for sku, name, qty, usd_price in EXCEL_ITEMS:
        part = ensure_part(
            category,
            f'EEPOS-{sku}',
            name,
            f'EEPOS purchasable component from XK-1 quotation, quantity {qty}',
            component=True,
            assembly=False,
            purchaseable=True,
            salable=False,
        )
        supplier_part = ensure_supplier_part(part, eepos, sku, name, usd_price)
        component_supplier_parts.append((supplier_part, Decimal(qty), Money(Decimal(usd_price), 'USD')))

    service_supplier_parts = []
    for sku, name, qty, usd_price in SERVICE_ITEMS:
        part = ensure_part(
            category,
            f'EEPOS-{sku}',
            name,
            'Dịch vụ logistics/đóng gói từ báo giá EEPOS - XK-1',
            component=True,
            assembly=False,
            purchaseable=True,
            salable=False,
        )
        supplier_part = ensure_supplier_part(part, eepos, sku, name, usd_price)
        service_supplier_parts.append((supplier_part, Decimal(qty), Money(Decimal(usd_price), 'USD')))

    pom = ensure_part(
        category,
        'DTI-DEMO-POM-VF37',
        'POM mock Bridge Crane VF/3-7',
        'POM mock tạo từ các linh kiện trong báo giá EEPOS - XK-1',
        component=False,
        assembly=True,
        purchaseable=True,
        salable=True,
    )
    pom_supplier_part = ensure_supplier_part(
        pom,
        eepos,
        'POM-MOCK-VF37',
        'Suspended rail guide assembly Bridge Crane - Vietnam - VF/3-7',
        '391319',
    )

    for supplier_part, qty, _price in component_supplier_parts:
        BomItem.objects.update_or_create(
            part=pom,
            sub_part=supplier_part.part,
            defaults={'quantity': qty, 'reference': supplier_part.SKU},
        )

    build = Build.objects.create(
        reference='BO9001',
        title='Build POM mock Bridge Crane VF/3-7 từ linh kiện EEPOS',
        part=pom,
        quantity=1,
        status=BuildStatus.PENDING.value,
        destination=workshop_location,
        project_code=project,
    )
    build.create_build_line_items()

    sales_contract = Contract.objects.create(
        reference='DTT-SALES-DEMO-2026',
        contract_type=Contract.ContractType.SALES,
        title='Hợp đồng DTT 1 - cung cấp hệ ray treo súng hàn',
        project_code=project,
        buyer=narime,
        seller=dti,
        party_a_contact=dti_sales_contact,
        party_b_contact=narime_contact,
        issue_date=date(2026, 3, 28),
        effective_date=date(2026, 4, 6),
        work_scope=SALES_SCOPE,
        delivery_terms='Theo tiến độ dự án, thực hiện tại cơ sở bên B và hiện trường nhà máy VinFast.',
        payment_terms='Tạm ứng 30%, thanh toán theo các mốc 60%, 90%, 97% và giữ lại bảo hành 3%.',
        warranty_terms='Theo điều khoản bảo hành của hợp đồng DTT 1.',
        total_amount=Decimal('26075895729'),
        vat_rate=Decimal('10'),
        amount_text='Hai mươi tám tỷ, sáu trăm tám mươi ba triệu, bốn trăm tám mươi lăm nghìn, ba trăm linh hai đồng.',
        notes='Demo seed từ /home/anhlc/Downloads/DTT 1 .doc',
    )

    sales_order = SalesOrder.objects.create(
        reference='SO9001',
        description='Đơn bán demo cho hợp đồng DTT 1',
        customer=narime,
        status=SalesOrderStatus.PENDING.value,
        order_currency='VND',
        project_code=project,
        start_date=date(2026, 3, 28),
        target_date=date(2026, 4, 6),
    )
    sales_line = SalesOrderLineItem.objects.create(
        order=sales_order,
        part=pom,
        quantity=1,
        sale_price=Money(Decimal('26075895729'), 'VND'),
        target_date=date(2026, 4, 6),
        project_code=project,
        reference='POM mock VF/3-7',
    )
    set_contract_orders(sales_contract, sales_orders=[sales_order])

    purchase_contract = Contract.objects.create(
        reference='DTI-PO.09.03.2026',
        contract_type=Contract.ContractType.PURCHASE,
        title='Purchase Contract Bridge Crane VF/3-7 - EEPOS',
        project_code=project,
        buyer=dti,
        seller=eepos,
        party_a_contact=eepos_contact,
        party_b_contact=dti_purchase_contact,
        sales_contract=sales_contract,
        issue_date=date(2026, 3, 9),
        effective_date=date(2026, 4, 6),
        work_scope=PURCHASE_SCOPE,
        delivery_terms='EXW; estimated shipment before 06 April 2026; destination Hai Phong Seaport / Noi Bai Airport.',
        payment_terms='T/T: 50% khi đặt hàng, 50% trước khi giao hàng.',
        warranty_terms='12 tháng theo tiêu chuẩn nhà sản xuất.',
        total_amount=Decimal('391319'),
        vat_rate=Decimal('0'),
        amount_text='Three hundred ninety-one thousand three hundred nineteen US dollars.',
        notes='Demo seed từ signed PDF và Báo giá Eepos - XK-1.xlsx',
    )

    po_default = PurchaseOrder.objects.create(
        reference='PO9001',
        description='Đơn mua demo loại Mặc định - nhập kho thường',
        supplier=eepos,
        status=PurchaseOrderStatus.PENDING.value,
        order_currency='USD',
        project_code=project,
        start_date=date(2026, 3, 9),
        target_date=date(2026, 4, 6),
        destination=default_location,
    )

    po_commercial = PurchaseOrder.objects.create(
        reference='PO9002',
        description='Đơn mua demo loại Thương mại, liên kết đơn bán SO9001',
        supplier=eepos,
        status=PurchaseOrderStatus.PENDING.value,
        output_type=PurchaseOrder.OutputType.COMMERCIAL,
        sales_order=sales_order,
        order_currency='USD',
        project_code=project,
        start_date=date(2026, 3, 9),
        target_date=date(2026, 4, 6),
    )

    po_commercial_extra = PurchaseOrder.objects.create(
        reference='PO9005',
        description='Đơn mua demo thương mại bổ sung, liên kết đơn bán SO9001',
        supplier=eepos,
        status=PurchaseOrderStatus.PENDING.value,
        output_type=PurchaseOrder.OutputType.COMMERCIAL,
        sales_order=sales_order,
        order_currency='USD',
        project_code=project,
        start_date=date(2026, 3, 9),
        target_date=date(2026, 4, 6),
    )

    po_workshop = PurchaseOrder.objects.create(
        reference='PO9003',
        description='Đơn mua demo loại Xưởng, cấp vật tư cho BuildOrder POM mock',
        supplier=eepos,
        status=PurchaseOrderStatus.PENDING.value,
        output_type=PurchaseOrder.OutputType.WORKSHOP,
        build_order=build,
        order_currency='USD',
        project_code=project,
        start_date=date(2026, 3, 9),
        target_date=date(2026, 4, 6),
    )

    po_site = PurchaseOrder.objects.create(
        reference='PO9004',
        description='Đơn mua demo loại Công trường, nhận dịch vụ vận chuyển và đóng thùng',
        supplier=eepos,
        status=PurchaseOrderStatus.PENDING.value,
        output_type=PurchaseOrder.OutputType.CONSTRUCTION_SITE,
        destination=site_location,
        order_currency='USD',
        project_code=project,
        start_date=date(2026, 3, 9),
        target_date=date(2026, 4, 6),
    )

    PurchaseOrderLineItem.objects.create(
        order=po_commercial,
        part=pom_supplier_part,
        quantity=1,
        sales_order_line=sales_line,
        purchase_price=Money(Decimal('391319'), 'USD'),
        purchase_price_currency='USD',
        project_code=project,
        target_date=date(2026, 4, 6),
    )

    PurchaseOrderLineItem.objects.create(
        order=po_commercial_extra,
        part=pom_supplier_part,
        quantity=1,
        sales_order_line=sales_line,
        purchase_price=Money(Decimal('391319'), 'USD'),
        purchase_price_currency='USD',
        project_code=project,
        target_date=date(2026, 4, 6),
    )

    for supplier_part, qty, price in component_supplier_parts[:4]:
        PurchaseOrderLineItem.objects.create(
            order=po_default,
            part=supplier_part,
            quantity=qty,
            purchase_price=price,
            purchase_price_currency='USD',
            project_code=project,
            target_date=date(2026, 4, 6),
            destination=default_location,
        )

    build_lines = {line.bom_item.sub_part_id: line for line in build.build_lines.select_related('bom_item')}
    for supplier_part, qty, price in component_supplier_parts:
        PurchaseOrderLineItem.objects.create(
            order=po_workshop,
            part=supplier_part,
            quantity=qty,
            build_line=build_lines[supplier_part.part_id],
            purchase_price=price,
            purchase_price_currency='USD',
            project_code=project,
            target_date=date(2026, 4, 6),
        )

    for supplier_part, qty, price in service_supplier_parts:
        PurchaseOrderLineItem.objects.create(
            order=po_site,
            part=supplier_part,
            quantity=qty,
            purchase_price=price,
            purchase_price_currency='USD',
            project_code=project,
            target_date=date(2026, 4, 6),
            destination=site_location,
        )

    purchase_orders = [
        po_default,
        po_commercial,
        po_workshop,
        po_site,
        po_commercial_extra,
    ]
    set_contract_orders(purchase_contract, purchase_orders=purchase_orders)

    xk1_project, _ = ProjectCode.objects.update_or_create(
        code='PRJ-DTI-XK1-DEMO',
        defaults={
            'description': 'Demo hop dong moi tu DTT 1, PDF DTI-PO va Bao gia EEPOS XK-1'
        },
    )

    xk1_component_supplier_parts = []
    for sku, name, qty, usd_price in EXCEL_ITEMS:
        part = ensure_part(
            category,
            f'EEPOS-XK1-{sku}',
            name,
            f'Linh kien mock tu file Bao gia Eepos - XK-1.xlsx, so luong {qty}',
            component=True,
            assembly=False,
            purchaseable=True,
            salable=False,
        )
        supplier_part = ensure_supplier_part(part, eepos, f'XK1-{sku}', name, usd_price)
        xk1_component_supplier_parts.append(
            (supplier_part, Decimal(qty), Money(Decimal(usd_price), 'USD'))
        )

    xk1_service_supplier_parts = []
    for sku, name, qty, usd_price in SERVICE_ITEMS:
        part = ensure_part(
            category,
            f'EEPOS-XK1-{sku}',
            name,
            'Dich vu logistics/dong goi cho demo XK-1',
            component=True,
            assembly=False,
            purchaseable=True,
            salable=False,
        )
        supplier_part = ensure_supplier_part(part, eepos, f'XK1-{sku}', name, usd_price)
        xk1_service_supplier_parts.append(
            (supplier_part, Decimal(qty), Money(Decimal(usd_price), 'USD'))
        )

    xk1_pom = ensure_part(
        category,
        'DTI-XK1-DEMO-POM-VF37',
        'POM mock XK-1 Bridge Crane VF/3-7',
        'BOM mock moi tao tu cac linh kien trong Bao gia Eepos - XK-1.xlsx',
        component=False,
        assembly=True,
        purchaseable=True,
        salable=True,
    )
    xk1_pom_supplier_part = ensure_supplier_part(
        xk1_pom,
        eepos,
        'XK1-POM-MOCK-VF37',
        'Suspended rail guide assembly Bridge Crane - Vietnam - VF/3-7 XK-1 demo',
        '391319',
    )

    for supplier_part, qty, _price in xk1_component_supplier_parts:
        BomItem.objects.update_or_create(
            part=xk1_pom,
            sub_part=supplier_part.part,
            defaults={'quantity': qty, 'reference': supplier_part.SKU},
        )

    xk1_build = Build.objects.create(
        reference='BO9101',
        title='BuildOrder mock XK-1 Bridge Crane VF/3-7',
        part=xk1_pom,
        quantity=1,
        status=BuildStatus.PENDING.value,
        destination=workshop_location,
        project_code=xk1_project,
    )
    xk1_build.create_build_line_items()

    xk1_sales_contract = Contract.objects.create(
        reference='DTT-XK1-SALES-DEMO-2026',
        contract_type=Contract.ContractType.SALES,
        title='Hop dong ban demo XK-1 - cung cap he ray treo sung han',
        project_code=xk1_project,
        buyer=narime,
        seller=dti,
        party_a_contact=dti_sales_contact,
        party_b_contact=narime_contact,
        issue_date=date(2026, 3, 28),
        effective_date=date(2026, 4, 6),
        work_scope='Demo moi doc lap voi DTT-SALES-DEMO-2026, tao tu DTT 1 .doc va cau hinh EEPOS XK-1.',
        delivery_terms='Theo tien do du an, giao tai xuong va cong truong VinFast.',
        payment_terms='Tam ung va thanh toan theo cac moc nghiem thu demo.',
        warranty_terms='Bao hanh theo dieu khoan hop dong DTT 1.',
        total_amount=Decimal('26075895729'),
        vat_rate=Decimal('10'),
        amount_text='Hai muoi tam ty, sau tram tam muoi ba trieu, bon tram tam muoi lam nghin, ba tram linh hai dong.',
        notes='Demo moi khac DTT-SALES-DEMO-2026, tao tu /home/anhlc/Downloads/DTT 1 .doc',
    )

    xk1_sales_order = SalesOrder.objects.create(
        reference='SO9101',
        description='Don ban demo XK-1 lien ket hop dong DTT-XK1-SALES-DEMO-2026',
        customer=narime,
        status=SalesOrderStatus.PENDING.value,
        order_currency='VND',
        project_code=xk1_project,
        start_date=date(2026, 3, 28),
        target_date=date(2026, 4, 6),
    )
    xk1_sales_line = SalesOrderLineItem.objects.create(
        order=xk1_sales_order,
        part=xk1_pom,
        quantity=1,
        sale_price=Money(Decimal('26075895729'), 'VND'),
        target_date=date(2026, 4, 6),
        project_code=xk1_project,
        reference='POM mock XK-1 VF/3-7',
    )
    set_contract_orders(xk1_sales_contract, sales_orders=[xk1_sales_order])

    xk1_purchase_contract = Contract.objects.create(
        reference='DTI-PO-XK1-DEMO-2026',
        contract_type=Contract.ContractType.PURCHASE,
        title='Purchase Contract demo XK-1 Bridge Crane VF/3-7 - EEPOS',
        project_code=xk1_project,
        buyer=dti,
        seller=eepos,
        party_a_contact=eepos_contact,
        party_b_contact=dti_purchase_contact,
        sales_contract=xk1_sales_contract,
        issue_date=date(2026, 3, 9),
        effective_date=date(2026, 4, 6),
        work_scope='Suspended rail guide assembly Bridge Crane VF/3-7 theo signed PDF DTI-PO.09.03.2026 va Bao gia EEPOS XK-1.',
        delivery_terms='EXW; estimated shipment before 06 April 2026; destination Hai Phong Seaport / Noi Bai Airport.',
        payment_terms='T/T: 50% khi dat hang, 50% truoc khi giao hang.',
        warranty_terms='12 thang theo tieu chuan nha san xuat.',
        total_amount=Decimal('391319'),
        vat_rate=Decimal('0'),
        amount_text='Three hundred ninety-one thousand three hundred nineteen US dollars.',
        notes='Demo moi khac DTI-PO.09.03.2026, tao tu signed PDF va Bao gia Eepos - XK-1.xlsx',
    )

    xk1_po_default = PurchaseOrder.objects.create(
        reference='PO9101',
        description='Don mua XK-1 loai Mac dinh - nhap kho thuong',
        supplier=eepos,
        status=PurchaseOrderStatus.PENDING.value,
        order_currency='USD',
        project_code=xk1_project,
        start_date=date(2026, 3, 9),
        target_date=date(2026, 4, 6),
        destination=default_location,
    )

    xk1_po_commercial = PurchaseOrder.objects.create(
        reference='PO9102',
        description='Don mua XK-1 loai Thuong mai, lien ket SO9101',
        supplier=eepos,
        status=PurchaseOrderStatus.PENDING.value,
        output_type=PurchaseOrder.OutputType.COMMERCIAL,
        sales_order=xk1_sales_order,
        order_currency='USD',
        project_code=xk1_project,
        start_date=date(2026, 3, 9),
        target_date=date(2026, 4, 6),
    )

    xk1_po_workshop = PurchaseOrder.objects.create(
        reference='PO9103',
        description='Don mua XK-1 loai Xuong, cap vat tu cho BO9101',
        supplier=eepos,
        status=PurchaseOrderStatus.PENDING.value,
        output_type=PurchaseOrder.OutputType.WORKSHOP,
        build_order=xk1_build,
        order_currency='USD',
        project_code=xk1_project,
        start_date=date(2026, 3, 9),
        target_date=date(2026, 4, 6),
    )

    xk1_po_site = PurchaseOrder.objects.create(
        reference='PO9104',
        description='Don mua XK-1 loai Cong truong, nhan dich vu tai cong truong',
        supplier=eepos,
        status=PurchaseOrderStatus.PENDING.value,
        output_type=PurchaseOrder.OutputType.CONSTRUCTION_SITE,
        destination=site_location,
        order_currency='USD',
        project_code=xk1_project,
        start_date=date(2026, 3, 9),
        target_date=date(2026, 4, 6),
    )

    PurchaseOrderLineItem.objects.create(
        order=xk1_po_commercial,
        part=xk1_pom_supplier_part,
        quantity=1,
        sales_order_line=xk1_sales_line,
        purchase_price=Money(Decimal('391319'), 'USD'),
        purchase_price_currency='USD',
        project_code=xk1_project,
        target_date=date(2026, 4, 6),
    )

    for supplier_part, qty, price in xk1_component_supplier_parts[:4]:
        PurchaseOrderLineItem.objects.create(
            order=xk1_po_default,
            part=supplier_part,
            quantity=qty,
            purchase_price=price,
            purchase_price_currency='USD',
            project_code=xk1_project,
            target_date=date(2026, 4, 6),
            destination=default_location,
        )

    xk1_build_lines = {
        line.bom_item.sub_part_id: line
        for line in xk1_build.build_lines.select_related('bom_item')
    }
    for supplier_part, qty, price in xk1_component_supplier_parts:
        PurchaseOrderLineItem.objects.create(
            order=xk1_po_workshop,
            part=supplier_part,
            quantity=qty,
            build_line=xk1_build_lines[supplier_part.part_id],
            purchase_price=price,
            purchase_price_currency='USD',
            project_code=xk1_project,
            target_date=date(2026, 4, 6),
        )

    for supplier_part, qty, price in xk1_service_supplier_parts:
        PurchaseOrderLineItem.objects.create(
            order=xk1_po_site,
            part=supplier_part,
            quantity=qty,
            purchase_price=price,
            purchase_price_currency='USD',
            project_code=xk1_project,
            target_date=date(2026, 4, 6),
            destination=site_location,
        )

    xk1_purchase_orders = [
        xk1_po_default,
        xk1_po_commercial,
        xk1_po_workshop,
        xk1_po_site,
    ]
    set_contract_orders(xk1_purchase_contract, purchase_orders=xk1_purchase_orders)

    print('Seeded DTI demo data:')
    print('  Sales contract:', sales_contract.reference, 'SO:', sales_order.reference)
    print('  Purchase contract:', purchase_contract.reference)
    print('  Purchase orders:', ', '.join([po.reference for po in purchase_orders]))
    print('  EEPOS supplier parts:', len(component_supplier_parts) + len(service_supplier_parts))
    print('  POM build:', build.reference, 'build lines:', build.build_lines.count())
    print('Seeded DTI XK-1 demo data:')
    print('  Sales contract:', xk1_sales_contract.reference, 'SO:', xk1_sales_order.reference)
    print('  Purchase contract:', xk1_purchase_contract.reference)
    print('  Purchase orders:', ', '.join([po.reference for po in xk1_purchase_orders]))
    print(
        '  EEPOS XK-1 supplier parts:',
        len(xk1_component_supplier_parts) + len(xk1_service_supplier_parts),
    )
    print('  POM build:', xk1_build.reference, 'build lines:', xk1_build.build_lines.count())


seed()
