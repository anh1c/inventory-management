import { t } from '@lingui/core/macro';
import { useEffect, useMemo, useState } from 'react';

import { ApiEndpoints } from '@lib/enums/ApiEndpoints';
import { ModelType } from '@lib/enums/ModelType';
import { apiUrl } from '@lib/functions/Api';
import type { ApiFormFieldSet } from '@lib/types/Forms';

export type ContractType = 'sales' | 'purchase';

export function useContractFields({
  contractType,
  salesContract
}: {
  contractType?: ContractType;
  salesContract?: any;
}): ApiFormFieldSet {
  const isSalesContract = contractType === 'sales';
  const isPurchaseContract = contractType === 'purchase';
  const [selectedSalesContract, setSelectedSalesContract] = useState<any>(salesContract);
  const [totalAmount, setTotalAmount] = useState<number | null>(null);
  const [vatRate, setVatRate] = useState<number | null>(null);
  const [issueDate, setIssueDate] = useState<string | null>(null);
  const [effectiveDate, setEffectiveDate] = useState<string | null>(null);

  useEffect(() => {
    setSelectedSalesContract(salesContract);
  }, [salesContract]);

  const selectedProjectCode = selectedSalesContract?.project_code ?? undefined;
  const calculatedVatAmount = useMemo(() => {
    const amount = Number(totalAmount ?? 0);
    const rate = Number(vatRate ?? 0);

    return Number.isFinite(amount) && Number.isFinite(rate)
      ? (amount * rate) / 100
      : 0;
  }, [totalAmount, vatRate]);
  const calculatedGrandTotal = useMemo(() => {
    const amount = Number(totalAmount ?? 0);

    return Number.isFinite(amount) ? amount + calculatedVatAmount : 0;
  }, [totalAmount, calculatedVatAmount]);
  const effectiveDateError = useMemo(() => {
    if (issueDate && effectiveDate && effectiveDate <= issueDate) {
      return t`Ngày hiệu lực phải sau ngày ký hợp đồng`;
    }

    return undefined;
  }, [issueDate, effectiveDate]);

  return {
    contract_type: {
      field_type: 'choice',
      choices: [
        { value: 'sales', display_name: t`Hợp đồng bán` },
        { value: 'purchase', display_name: t`Hợp đồng mua` }
      ],
      hidden: !!contractType
    },
    reference: {
      field_type: 'string',
      label: t`Số hợp đồng`,
      description: t`Số hoặc mã tham chiếu hợp đồng`
    },
    title: {
      field_type: 'string',
      label: t`Tên hợp đồng`,
      description: t`Tên gọi hoặc mô tả ngắn của hợp đồng`
    },
    project_code: {
      field_type: 'related field',
      api_url: apiUrl(ApiEndpoints.project_code_list),
      label: t`Mã dự án`,
      description: selectedProjectCode
        ? t`Mã dự án được lấy tự động từ hợp đồng bán liên kết`
        : t`Mã dự án liên kết với hợp đồng`,
      disabled: isPurchaseContract && !!selectedProjectCode,
      value: selectedProjectCode
    },
    sales_contract: {
      field_type: 'related field',
      label: t`Hợp đồng bán liên kết`,
      description: t`Hợp đồng bán làm nguồn cho hợp đồng mua này`,
      hidden: isSalesContract,
      api_url: apiUrl(ApiEndpoints.contract_list),
      filters: {
        contract_type: 'sales'
      },
      onValueChange: (_value: any, record?: any) => setSelectedSalesContract(record)
    },
    sales_orders: {
      field_type: 'related field',
      model: ModelType.salesorder,
      api_url: apiUrl(ApiEndpoints.sales_order_list),
      multiple: true,
      label: t`Đơn bán liên kết`,
      description: t`Chọn một hoặc nhiều đơn bán thuộc hợp đồng bán này`,
      hidden: isPurchaseContract,
      filters: selectedProjectCode ? { project_code: selectedProjectCode } : undefined
    },
    purchase_orders: {
      field_type: 'related field',
      model: ModelType.purchaseorder,
      api_url: apiUrl(ApiEndpoints.purchase_order_list),
      multiple: true,
      label: t`Đơn mua liên kết`,
      description: t`Chọn một hoặc nhiều đơn mua thuộc hợp đồng mua này`,
      hidden: isSalesContract,
      filters: selectedProjectCode ? { project_code: selectedProjectCode } : undefined
    },
    party_a_name: {
      field_type: 'string',
      label: t`Bên A`,
      description: t`Tên pháp nhân hoặc tổ chức của Bên A`
    },
    party_a_representative: {
      field_type: 'string',
      label: t`Đại diện Bên A`,
      description: t`Người đại diện ký hợp đồng của Bên A`
    },
    party_b_name: {
      field_type: 'string',
      label: t`Bên B`,
      description: t`Tên pháp nhân hoặc tổ chức của Bên B`
    },
    party_b_representative: {
      field_type: 'string',
      label: t`Đại diện Bên B`,
      description: t`Người đại diện ký hợp đồng của Bên B`
    },
    issue_date: {
      field_type: 'date',
      label: t`Ngày ký hợp đồng`,
      description: t`Ngày hai bên ký kết hợp đồng`,
      onValueChange: (value: any) => setIssueDate(value)
    },
    effective_date: {
      field_type: 'date',
      label: t`Ngày hiệu lực`,
      description: t`Ngày hợp đồng bắt đầu có hiệu lực`,
      error: effectiveDateError,
      onValueChange: (value: any) => setEffectiveDate(value)
    },
    work_scope: {
      field_type: 'string',
      label: t`Nội dung công việc`,
      description: t`Phạm vi cung cấp hàng hóa, vật tư, thiết bị hoặc dịch vụ`
    },
    delivery_terms: {
      field_type: 'string',
      label: t`Điều kiện giao hàng`,
      description: t`Tiến độ, địa điểm và điều kiện thực hiện/giao hàng`
    },
    payment_terms: {
      field_type: 'string',
      label: t`Điều khoản thanh toán`,
      description: t`Phương thức thanh toán, tạm ứng, nghiệm thu, quyết toán`
    },
    warranty_terms: {
      field_type: 'string',
      label: t`Điều khoản bảo hành`,
      description: t`Thời hạn và điều kiện bảo hành`
    },
    total_amount: {
      field_type: 'decimal',
      label: t`Giá trị trước VAT`,
      description: t`Giá trị hợp đồng chưa bao gồm thuế VAT`,
      onValueChange: (value: any) => setTotalAmount(Number(value ?? 0))
    },
    vat_rate: {
      field_type: 'decimal',
      label: t`Thuế suất VAT (%)`,
      description: t`Tỷ lệ thuế giá trị gia tăng áp dụng cho hợp đồng`,
      onValueChange: (value: any) => setVatRate(Number(value ?? 0))
    },
    vat_amount: {
      field_type: 'decimal',
      label: t`Tiền VAT`,
      description: t`Số tiền thuế giá trị gia tăng`,
      disabled: true,
      value: calculatedVatAmount
    },
    grand_total: {
      field_type: 'decimal',
      label: t`Tổng giá trị hợp đồng`,
      description: t`Giá trị hợp đồng đã bao gồm VAT`,
      disabled: true,
      value: calculatedGrandTotal
    },
    amount_text: {
      field_type: 'string',
      label: t`Tổng giá trị bằng chữ`,
      description: t`Diễn giải tổng giá trị hợp đồng bằng chữ`
    },
    notes: {
      field_type: 'string',
      label: t`Ghi chú`,
      description: t`Thông tin bổ sung liên quan đến hợp đồng`
    }
  };
}
