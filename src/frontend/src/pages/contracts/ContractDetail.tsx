import { t } from '@lingui/core/macro';
import { Alert, Badge, Skeleton, Stack, Text } from '@mantine/core';
import {
  IconClipboardText,
  IconFileDescription,
  IconInfoCircle,
  IconShoppingCart,
  IconTruckDelivery
} from '@tabler/icons-react';
import { type ReactNode, useMemo } from 'react';
import { useParams } from 'react-router-dom';

import { ApiEndpoints } from '@lib/enums/ApiEndpoints';
import { ModelType } from '@lib/enums/ModelType';
import { getDetailUrl } from '@lib/functions/Navigation';
import {
  type DetailsField,
  DetailsTable
} from '../../components/details/Details';
import { ItemDetailsGrid } from '../../components/details/ItemDetails';
import InstanceDetail from '../../components/nav/InstanceDetail';
import { PageDetail } from '../../components/nav/PageDetail';
import AttachmentPanel from '../../components/panels/AttachmentPanel';
import type { PanelType } from '../../components/panels/Panel';
import { PanelGroup } from '../../components/panels/PanelGroup';
import { formatCurrency } from '../../defaults/formatters';
import { useInstance } from '../../hooks/UseInstance';
import { ContractTable } from '../../tables/contract/ContractTable';

type ContractRecord = {
  pk?: number;
  reference?: string;
  contract_type?: 'sales' | 'purchase' | string;
  title?: string;
  project_code?: number;
  project_code_detail?: { code?: string; description?: string } | null;
  sales_contract?: number | null;
  sales_contract_detail?: ContractRecord | null;
  party_a_name?: string;
  party_a_representative?: string;
  party_b_name?: string;
  party_b_representative?: string;
  issue_date?: string;
  effective_date?: string;
  total_amount?: number | string | null;
  vat_rate?: number | string | null;
  vat_amount?: number | string | null;
  grand_total?: number | string | null;
  amount_text?: string;
  work_scope?: string;
  delivery_terms?: string;
  payment_terms?: string;
  warranty_terms?: string;
  notes?: string;
};

function contractTypeLabel(contract?: ContractRecord) {
  if (contract?.contract_type === 'purchase') {
    return t`Hợp đồng mua`;
  }

  if (contract?.contract_type === 'sales') {
    return t`Hợp đồng bán`;
  }

  return contract?.contract_type ?? '-';
}

function currencyValue(value?: number | string | null) {
  return formatCurrency(value, { currency: 'VND' });
}

function vatRateValue(value?: number | string | null) {
  if (value === null || value === undefined || value === '') {
    return '-';
  }

  return `${value}%`;
}

function SalesContractSummary({
  contract
}: Readonly<{ contract?: ContractRecord | null }>) {
  if (!contract) {
    return (
      <Alert color='yellow' icon={<IconInfoCircle />}>
        {t`Hợp đồng mua này chưa được liên kết với hợp đồng bán.`}
      </Alert>
    );
  }

  const fields: DetailsField[] = [
    {
      type: 'link',
      name: 'pk',
      label: t`Số hợp đồng`,
      model: ModelType.contract,
      model_formatter: (record: ContractRecord) => record.reference ?? '-',
      copy: true
    },
    {
      type: 'text',
      name: 'contract_type',
      label: t`Loại hợp đồng`,
      value_formatter: () => contractTypeLabel(contract)
    },
    {
      type: 'text',
      name: 'title',
      label: t`Tên hợp đồng`,
      copy: true
    },
    {
      type: 'text',
      name: 'project_code_detail.code',
      label: t`Mã dự án`,
      copy: true,
      hidden: !contract.project_code_detail?.code
    },
    {
      type: 'text',
      name: 'grand_total',
      label: t`Tổng giá trị hợp đồng`,
      value_formatter: () => currencyValue(contract.grand_total)
    }
  ];

  return <DetailsTable title={t`Hợp đồng bán liên kết`} fields={fields} item={contract} />;
}

export default function ContractDetail() {
  const { id } = useParams();

  const {
    instance: contract,
    instanceQuery,
    refreshInstance
  } = useInstance<ContractRecord>({
    endpoint: ApiEndpoints.contract_list,
    pk: id,
    params: {
      project_code_detail: true,
      sales_contract_detail: true
    }
  });

  const detailsPanel = useMemo(() => {
    if (instanceQuery.isFetching) {
      return <Skeleton />;
    }

    const generalFields: DetailsField[] = [
      {
        type: 'text',
        name: 'reference',
        label: t`Số hợp đồng`,
        copy: true
      },
      {
        type: 'text',
        name: 'contract_type',
        label: t`Loại hợp đồng`,
        value_formatter: () => contractTypeLabel(contract)
      },
      {
        type: 'text',
        name: 'title',
        label: t`Tên hợp đồng`,
        copy: true
      },
      {
        type: 'text',
        name: 'project_code_detail.code',
        label: t`Mã dự án`,
        copy: true,
        hidden: !contract?.project_code_detail?.code
      },
      {
        type: 'link',
        name: 'sales_contract',
        label: t`Hợp đồng bán liên kết`,
        model: ModelType.contract,
        model_formatter: (record: ContractRecord) => record.reference ?? '-',
        hidden: !contract?.sales_contract
      }
    ];

    const partyFields: DetailsField[] = [
      {
        type: 'text',
        name: 'party_a_name',
        label: t`Bên A`,
        copy: true
      },
      {
        type: 'text',
        name: 'party_a_representative',
        label: t`Đại diện Bên A`,
        copy: true
      },
      {
        type: 'text',
        name: 'party_b_name',
        label: t`Bên B`,
        copy: true
      },
      {
        type: 'text',
        name: 'party_b_representative',
        label: t`Đại diện Bên B`,
        copy: true
      },
      {
        type: 'date',
        name: 'issue_date',
        label: t`Ngày ký`,
        copy: true
      },
      {
        type: 'date',
        name: 'effective_date',
        label: t`Ngày hiệu lực`,
        copy: true
      }
    ];

    const valueFields: DetailsField[] = [
      {
        type: 'text',
        name: 'total_amount',
        label: t`Giá trị trước VAT`,
        value_formatter: () => currencyValue(contract?.total_amount)
      },
      {
        type: 'text',
        name: 'vat_rate',
        label: t`Thuế suất VAT`,
        value_formatter: () => vatRateValue(contract?.vat_rate)
      },
      {
        type: 'text',
        name: 'vat_amount',
        label: t`Tiền VAT`,
        value_formatter: () => currencyValue(contract?.vat_amount)
      },
      {
        type: 'text',
        name: 'grand_total',
        label: t`Tổng giá trị hợp đồng`,
        value_formatter: () => currencyValue(contract?.grand_total)
      },
      {
        type: 'text',
        name: 'amount_text',
        label: t`Tổng giá trị bằng chữ`,
        copy: true
      }
    ];

    const termFields: DetailsField[] = [
      {
        type: 'text',
        name: 'work_scope',
        label: t`Nội dung công việc`,
        copy: true
      },
      {
        type: 'text',
        name: 'delivery_terms',
        label: t`Điều kiện giao hàng`,
        copy: true
      },
      {
        type: 'text',
        name: 'payment_terms',
        label: t`Điều khoản thanh toán`,
        copy: true
      },
      {
        type: 'text',
        name: 'warranty_terms',
        label: t`Bảo hành`,
        copy: true
      },
      {
        type: 'text',
        name: 'notes',
        label: t`Ghi chú`,
        copy: true
      }
    ];

    return (
      <ItemDetailsGrid>
        <DetailsTable title={t`Thông tin hợp đồng`} fields={generalFields} item={contract} />
        <DetailsTable title={t`Các bên ký kết`} fields={partyFields} item={contract} />
        <DetailsTable title={t`Giá trị hợp đồng`} fields={valueFields} item={contract} />
        <DetailsTable title={t`Điều khoản`} fields={termFields} item={contract} />
      </ItemDetailsGrid>
    );
  }, [contract, instanceQuery]);

  const relatedContractsPanel = useMemo(() => {
    if (contract?.contract_type === 'sales') {
      return contract.pk ? (
        <ContractTable
          contractType='purchase'
          salesContract={contract}
          salesContractId={contract.pk}
        />
      ) : (
        <Skeleton />
      );
    }

    return <SalesContractSummary contract={contract?.sales_contract_detail} />;
  }, [contract]);

  const panels: PanelType[] = useMemo(
    () => [
      {
        name: 'detail',
        label: t`Chi tiết hợp đồng`,
        icon: <IconInfoCircle />,
        content: detailsPanel
      },
      {
        name: 'linked-contracts',
        label:
          contract?.contract_type === 'sales'
            ? t`Hợp đồng mua liên kết`
            : t`Hợp đồng bán liên kết`,
        icon:
          contract?.contract_type === 'sales' ? (
            <IconShoppingCart />
          ) : (
            <IconTruckDelivery />
          ),
        content: relatedContractsPanel
      },
      AttachmentPanel({
        model_type: ModelType.contract,
        model_id: contract?.pk,
        label: t`Tài liệu hợp đồng`
      })
    ],
    [contract, detailsPanel, relatedContractsPanel]
  );

  const badges: ReactNode[] = useMemo(
    () => [
      <Badge
        color={contract?.contract_type === 'purchase' ? 'orange' : 'blue'}
        size='lg'
      >
        {contractTypeLabel(contract)}
      </Badge>
    ],
    [contract]
  );

  const subtitle = useMemo(() => {
    const values = [contract?.title, contract?.project_code_detail?.code].filter(Boolean);

    return values.join(' · ');
  }, [contract]);

  return (
    <InstanceDetail query={instanceQuery} requiredPermission={ModelType.contract}>
      <Stack gap='xs'>
        <PageDetail
          title={`${t`Hợp đồng`}: ${contract?.reference ?? ''}`}
          subtitle={subtitle}
          icon={<IconFileDescription size={18} />}
          badges={badges}
          breadcrumbs={[{ name: t`Hợp đồng`, url: '/contracts/' }]}
          lastCrumb={[
            {
              name: contract?.reference ?? t`Hợp đồng`,
              url: contract?.pk ? getDetailUrl(ModelType.contract, contract.pk) : ''
            }
          ]}
        />
        <PanelGroup
          pageKey='contract'
          panels={panels}
          model={ModelType.contract}
          instance={contract}
          reloadInstance={refreshInstance}
          id={contract?.pk ?? null}
        />
        {contract?.contract_type === 'sales' && (
          <Text size='xs' c='dimmed'>
            <IconClipboardText size={14} /> {t`Các hợp đồng mua trong bảng được lọc theo hợp đồng bán này.`}
          </Text>
        )}
      </Stack>
    </InstanceDetail>
  );
}
