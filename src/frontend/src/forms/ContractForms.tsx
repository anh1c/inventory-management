import { t } from '@lingui/core/macro';
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
      return t`Effective date must be after the contract issue date`;
    }

    return undefined;
  }, [issueDate, effectiveDate]);

  return {
    contract_type: {
      field_type: 'choice',
      choices: [
        { value: 'sales', display_name: t`Sales Contract` },
        { value: 'purchase', display_name: t`Purchase Contract` }
      ],
      hidden: !!contractType,
      onValueChange: (value: any) => setSelectedContractType(value)
    },
    reference: {
      field_type: 'string',
      label: t`Contract Number`,
      description: t`Contract number or reference code`
    },
    title: {
      field_type: 'string',
      label: t`Contract Name`,
      description: t`Contract name or short description`
    },
    project_code: {
      field_type: 'related field',
      api_url: apiUrl(ApiEndpoints.project_code_list),
      label: t`Project Code`,
      required: true,
      description: selectedProjectCode
        ? t`Project code is automatically taken from the linked sales contract`
        : t`Project code linked to this contract`,
      disabled: isPurchaseContract && !!selectedProjectCode,
      value: selectedProjectCode
    },
    sales_contract: {
      field_type: 'related field',
      label: t`Linked Sales Contract`,
      description: t`Sales contract used as the source for this purchase contract`,
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
      label: t`Buyer`,
      description: t`Company or customer buying under this contract`,
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
      label: t`Seller`,
      description: t`Company or supplier selling under this contract`,
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
      label: t`Party A Representative`,
      description: t`Select Party A representative from the seller contacts`,
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
      label: t`Party B Representative`,
      description: t`Select Party B representative from the buyer contacts`,
      adjustFilters: (value: ApiFormAdjustFilterType) => {
        return {
          ...value.filters,
          company: value.data.buyer
        };
      }
    },
    issue_date: {
      field_type: 'date',
      label: t`Contract Issue Date`,
      description: t`Date the contract is signed by both parties`,
      onValueChange: (value: any) => setIssueDate(value)
    },
    effective_date: {
      field_type: 'date',
      label: t`Effective Date`,
      description: t`Date the contract becomes effective`,
      error: effectiveDateError,
      onValueChange: (value: any) => setEffectiveDate(value)
    },
    work_scope: {
      field_type: 'string',
      label: t`Scope of Work`,
      description: t`Scope of goods, materials, equipment, or services supplied`
    },
    delivery_terms: {
      field_type: 'string',
      label: t`Delivery Terms`,
      description: t`Schedule, location, and delivery or execution conditions`
    },
    payment_terms: {
      field_type: 'string',
      label: t`Payment Terms`,
      description: t`Payment method, advance payment, acceptance, and final settlement`
    },
    warranty_terms: {
      field_type: 'string',
      label: t`Warranty Terms`,
      description: t`Warranty period and conditions`
    },
    total_amount: {
      field_type: 'decimal',
      label: t`Pre-VAT Value`,
      description: t`Contract value excluding VAT`,
      onValueChange: (value: any) => setTotalAmount(Number(value ?? 0))
    },
    vat_rate: {
      field_type: 'decimal',
      label: t`VAT Rate (%)`,
      description: t`Value-added tax rate applied to this contract`,
      onValueChange: (value: any) => setVatRate(Number(value ?? 0))
    },
    vat_amount: {
      field_type: 'decimal',
      label: t`VAT Amount`,
      description: t`Value-added tax amount`,
      disabled: true,
      value: calculatedVatAmount
    },
    grand_total: {
      field_type: 'decimal',
      label: t`Total Contract Value`,
      description: t`Contract value including VAT`,
      disabled: true,
      value: calculatedGrandTotal
    },
    amount_text: {
      field_type: 'string',
      label: t`Amount In Words`,
      description: t`Text representation of the total contract value`
    },
    notes: {
      field_type: 'string',
      label: t`Notes`,
      description: t`Additional information related to this contract`
    }
  };
}
