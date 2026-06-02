import { useEffect, useMemo, useState } from 'react';

import { ApiEndpoints } from '@lib/enums/ApiEndpoints';
import { apiUrl } from '@lib/functions/Api';
import type { ApiFormAdjustFilterType, ApiFormFieldSet } from '@lib/types/Forms';

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
  const [selectedContractType, setSelectedContractType] = useState<ContractType | undefined>(contractType);
  const [selectedSalesContract, setSelectedSalesContract] = useState<any>(salesContract);
  const [totalAmount, setTotalAmount] = useState<number | null>(null);
  const [vatRate, setVatRate] = useState<number | null>(null);
  const [issueDate, setIssueDate] = useState<string | null>(null);
  const [effectiveDate, setEffectiveDate] = useState<string | null>(null);

  useEffect(() => {
    setSelectedSalesContract(salesContract);
  }, [salesContract]);

  useEffect(() => {
    setSelectedContractType(contractType);
  }, [contractType]);

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
      return 'Ngày hiệu lực phải sau ngày ký hợp đồng';
    }

    return undefined;
  }, [issueDate, effectiveDate]);

  return {
    contract_type: {
      field_type: 'choice',
      choices: [
        { value: 'sales', display_name: 'Hợp đồng bán' },
        { value: 'purchase', display_name: 'Hợp đồng mua' }
      ],
      hidden: !!contractType,
      onValueChange: (value: any) => setSelectedContractType(value)
    },
    reference: {
      field_type: 'string',
      label: 'Số hợp đồng',
      description: 'Số hoặc mã tham chiếu hợp đồng'
    },
    title: {
      field_type: 'string',
      label: 'Tên hợp đồng',
      description: 'Tên gọi hoặc mô tả ngắn của hợp đồng'
    },
    project_code: {
      field_type: 'related field',
      api_url: apiUrl(ApiEndpoints.project_code_list),
      label: 'Mã dự án',
      required: true,
      description: selectedProjectCode
        ? 'Mã dự án được lấy tự động từ hợp đồng bán liên kết'
        : 'Mã dự án liên kết với hợp đồng này',
      disabled: isPurchaseContract && !!selectedProjectCode,
      value: selectedProjectCode
    },
    sales_contract: {
      field_type: 'related field',
      label: 'Hợp đồng bán liên kết',
      description: 'Hợp đồng bán làm nguồn cho hợp đồng mua này',
      hidden: isSalesContract,
      api_url: apiUrl(ApiEndpoints.contract_list),
      filters: {
        contract_type: 'sales'
      },
      onValueChange: (_value: any, record?: any) => setSelectedSalesContract(record)
    },
    buyer: {
      field_type: 'related field',
      api_url: apiUrl(ApiEndpoints.company_list),
      label: 'Bên mua',
      description: 'Công ty hoặc khách hàng mua theo hợp đồng này',
      filters:
        selectedContractType === 'purchase'
          ? { is_internal: true, active: true }
          : selectedContractType === 'sales'
            ? { is_customer: true, active: true }
            : { active: true }
    },
    seller: {
      field_type: 'related field',
      api_url: apiUrl(ApiEndpoints.company_list),
      label: 'Bên bán',
      description: 'Công ty hoặc nhà cung cấp bán theo hợp đồng này',
      filters:
        selectedContractType === 'sales'
          ? { is_internal: true, active: true }
          : selectedContractType === 'purchase'
            ? { is_supplier: true, active: true }
            : { active: true }
    },
    party_a_contact: {
      field_type: 'related field',
      api_url: apiUrl(ApiEndpoints.contact_list),
      label: 'Đại diện Bên A',
      description: 'Chọn người đại diện Bên A từ danh bạ của Bên bán',
      adjustFilters: (value: ApiFormAdjustFilterType) => {
        return {
          ...value.filters,
          company: value.data.seller
        };
      }
    },
    party_b_contact: {
      field_type: 'related field',
      api_url: apiUrl(ApiEndpoints.contact_list),
      label: 'Đại diện Bên B',
      description: 'Chọn người đại diện Bên B từ danh bạ của Bên mua',
      adjustFilters: (value: ApiFormAdjustFilterType) => {
        return {
          ...value.filters,
          company: value.data.buyer
        };
      }
    },
    issue_date: {
      field_type: 'date',
      label: 'Ngày ký hợp đồng',
      description: 'Ngày hai bên ký hợp đồng',
      onValueChange: (value: any) => setIssueDate(value)
    },
    effective_date: {
      field_type: 'date',
      label: 'Ngày hiệu lực',
      description: 'Ngày hợp đồng bắt đầu có hiệu lực',
      error: effectiveDateError,
      onValueChange: (value: any) => setEffectiveDate(value)
    },
    work_scope: {
      field_type: 'string',
      label: 'Phạm vi công việc',
      description: 'Phạm vi hàng hóa, vật tư, thiết bị hoặc dịch vụ cung cấp'
    },
    delivery_terms: {
      field_type: 'string',
      label: 'Điều khoản giao hàng',
      description: 'Tiến độ, địa điểm và điều kiện giao hàng hoặc thực hiện'
    },
    payment_terms: {
      field_type: 'string',
      label: 'Điều khoản thanh toán',
      description: 'Phương thức thanh toán, tạm ứng, nghiệm thu và quyết toán'
    },
    warranty_terms: {
      field_type: 'string',
      label: 'Điều khoản bảo hành',
      description: 'Thời hạn và điều kiện bảo hành'
    },
    total_amount: {
      field_type: 'decimal',
      label: 'Giá trị trước VAT',
      description: 'Giá trị hợp đồng chưa bao gồm VAT',
      onValueChange: (value: any) => setTotalAmount(Number(value ?? 0))
    },
    vat_rate: {
      field_type: 'decimal',
      label: 'Thuế suất VAT (%)',
      description: 'Thuế suất VAT áp dụng cho hợp đồng này',
      onValueChange: (value: any) => setVatRate(Number(value ?? 0))
    },
    vat_amount: {
      field_type: 'decimal',
      label: 'Tiền VAT',
      description: 'Số tiền thuế VAT',
      disabled: true,
      value: calculatedVatAmount
    },
    grand_total: {
      field_type: 'decimal',
      label: 'Tổng giá trị hợp đồng',
      description: 'Giá trị hợp đồng đã bao gồm VAT',
      disabled: true,
      value: calculatedGrandTotal
    },
    amount_text: {
      field_type: 'string',
      label: 'Giá trị bằng chữ',
      description: 'Giá trị hợp đồng viết bằng chữ'
    },
    notes: {
      field_type: 'string',
      label: 'Ghi chú',
      description: 'Thông tin bổ sung liên quan đến hợp đồng'
    }
  };
}
