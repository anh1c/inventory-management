import { t } from '@lingui/core/macro';
import { Alert, Badge, Skeleton, Stack, Text } from '@mantine/core';
import {
  IconClipboardText,
  IconFileDollar,
  IconFileDescription,
  IconFileInvoice,
  IconInfoCircle,
  IconShoppingCart,
  IconTruckDelivery,
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
import NotesPanel from '../../components/panels/NotesPanel';
import type { PanelType } from '../../components/panels/Panel';
import { PanelGroup } from '../../components/panels/PanelGroup';
import { formatCurrency } from '../../defaults/formatters';
import { useInstance } from '../../hooks/UseInstance';
import { ContractTable } from '../../tables/contract/ContractTable';
import { PurchaseOrderTable } from '../../tables/purchasing/PurchaseOrderTable';
import { SalesOrderTable } from '../../tables/sales/SalesOrderTable';

type ContractRecord = {
  pk?: number;
  reference?: string;
  contract_type?: 'sales' | 'purchase' | string;
  title?: string;
  project_code?: number;
  project_code_detail?: { code?: string; description?: string } | null;
  sales_contract?: number | null;
  sales_contract_detail?: ContractRecord | null;
  buyer?: number | null;
  buyer_detail?: { name?: string; representative?: string; representative_position?: string } | null;
  seller?: number | null;
  seller_detail?: { name?: string; representative?: string; representative_position?: string } | null;
  party_a_contact?: number | null;
  party_a_contact_detail?: { name?: string; role?: string } | null;
  party_b_contact?: number | null;
  party_b_contact_detail?: { name?: string; role?: string } | null;
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
    return t`Purchase Contract`;
  }

  if (contract?.contract_type === 'sales') {
    return t`Sales Contract`;
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
        {t`This purchase contract is not linked to a sales contract.`}
      </Alert>
    );
  }

  const fields: DetailsField[] = [
    {
      type: 'link',
      name: 'pk',
      label: t`Contract Number`,
      icon: 'reference',
      model: ModelType.contract,
      model_formatter: (record: ContractRecord) => record.reference ?? '-',
      copy: true
    },
    {
      type: 'text',
      name: 'contract_type',
      label: t`Contract Type`,
      icon: 'license',
      value_formatter: () => contractTypeLabel(contract)
    },
    {
      type: 'text',
      name: 'title',
      label: t`Contract Name`,
      icon: 'description',
      copy: true
    },
    {
      type: 'text',
      name: 'project_code_detail.code',
      label: t`Project Code`,
      icon: 'sitemap',
      copy: true,
      hidden: !contract.project_code_detail?.code
    },
    {
      type: 'text',
      name: 'grand_total',
      label: t`Total Contract Value`,
      icon: 'pricing',
      value_formatter: () => currencyValue(contract.grand_total)
    }
  ];

  return <DetailsTable title={t`Linked Sales Contract`} fields={fields} item={contract} />;
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
      sales_contract_detail: true,
      buyer_detail: true,
      seller_detail: true,
      party_a_contact_detail: true,
      party_b_contact_detail: true
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
        label: t`Contract Number`,
        icon: 'reference',
        copy: true
      },
      {
        type: 'text',
        name: 'contract_type',
        label: t`Contract Type`,
        icon: 'license',
        value_formatter: () => contractTypeLabel(contract)
      },
      {
        type: 'text',
        name: 'title',
        label: t`Contract Name`,
        icon: 'description',
        copy: true
      },
      {
        type: 'text',
        name: 'project_code_detail.code',
        label: t`Project Code`,
        icon: 'sitemap',
        copy: true,
        hidden: !contract?.project_code_detail?.code
      },
      {
        type: 'link',
        name: 'sales_contract',
        label: t`Linked Sales Contract`,
        icon: 'link',
        model: ModelType.contract,
        model_formatter: (record: ContractRecord) => record.reference ?? '-',
        hidden: !contract?.sales_contract
      }
    ];

    const partyFields: DetailsField[] = [
      {
        type: 'link',
        name: 'seller',
        label: t`Party A`,
        icon: 'suppliers',
        model: ModelType.company,
        model_formatter: () =>
          contract?.seller_detail?.name || contract?.party_a_name || '-',
        copy: true
      },
      {
        type: 'text',
        name: 'seller_detail.representative',
        label: t`Party A Representative`,
        icon: 'user',
        value_formatter: () =>
          contract?.party_a_contact_detail?.name ??
          contract?.seller_detail?.representative ??
          contract?.party_a_representative ??
          '-',
        copy: true
      },
      {
        type: 'text',
        name: 'seller_detail.representative_position',
        label: t`Party A Representative Position`,
        icon: 'responsible',
        value_formatter: () =>
          contract?.party_a_contact_detail?.role ??
          contract?.seller_detail?.representative_position ??
          '-',
        copy: true
      },
      {
        type: 'link',
        name: 'buyer',
        label: t`Party B`,
        icon: 'suppliers',
        model: ModelType.company,
        model_formatter: () =>
          contract?.buyer_detail?.name || contract?.party_b_name || '-',
        copy: true
      },
      {
        type: 'text',
        name: 'buyer_detail.representative',
        label: t`Party B Representative`,
        icon: 'user',
        value_formatter: () =>
          contract?.party_b_contact_detail?.name ??
          contract?.buyer_detail?.representative ??
          contract?.party_b_representative ??
          '-',
        copy: true
      },
      {
        type: 'text',
        name: 'buyer_detail.representative_position',
        label: t`Party B Representative Position`,
        icon: 'responsible',
        value_formatter: () =>
          contract?.party_b_contact_detail?.role ??
          contract?.buyer_detail?.representative_position ??
          '-',
        copy: true
      },
      {
        type: 'date',
        name: 'issue_date',
        label: t`Issue Date`,
        icon: 'calendar_check',
        copy: true
      },
      {
        type: 'date',
        name: 'effective_date',
        label: t`Effective Date`,
        icon: 'calendar_check',
        copy: true
      }
    ];

    const valueFields: DetailsField[] = [
      {
        type: 'text',
        name: 'total_amount',
        label: t`Pre-VAT Value`,
        icon: 'pricing',
        value_formatter: () => currencyValue(contract?.total_amount)
      },
      {
        type: 'text',
        name: 'vat_rate',
        label: t`VAT Rate`,
        icon: 'tax_id',
        value_formatter: () => vatRateValue(contract?.vat_rate)
      },
      {
        type: 'text',
        name: 'vat_amount',
        label: t`VAT Amount`,
        icon: 'currency',
        value_formatter: () => currencyValue(contract?.vat_amount)
      },
      {
        type: 'text',
        name: 'grand_total',
        label: t`Total Contract Value`,
        icon: 'total_cost',
        value_formatter: () => currencyValue(contract?.grand_total)
      },
      {
        type: 'text',
        name: 'amount_text',
        label: t`Amount In Words`,
        icon: 'notes',
        copy: true
      }
    ];

    const termFields: DetailsField[] = [
      {
        type: 'text',
        name: 'work_scope',
        label: t`Scope of Work`,
        icon: 'stocktake',
        copy: true
      },
      {
        type: 'text',
        name: 'delivery_terms',
        label: t`Delivery Terms`,
        icon: 'deliver',
        copy: true
      },
      {
        type: 'text',
        name: 'payment_terms',
        label: t`Payment Terms`,
        icon: 'pricing',
        copy: true
      },
      {
        type: 'text',
        name: 'warranty_terms',
        label: t`Warranty`,
        icon: 'complete',
        copy: true
      },
      {
        type: 'text',
        name: 'notes',
        label: t`Notes`,
        icon: 'notes',
        copy: true
      }
    ];

    return (
      <ItemDetailsGrid>
        <DetailsTable title={t`Contract Information`} fields={generalFields} item={contract} />
        <DetailsTable title={t`Contract Parties`} fields={partyFields} item={contract} />
        <DetailsTable title={t`Contract Value`} fields={valueFields} item={contract} />
        <DetailsTable title={t`Terms`} fields={termFields} item={contract} />
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

  const relatedOrdersPanel = useMemo(() => {
    if (!contract?.pk) {
      return <Skeleton />;
    }

    if (contract.contract_type === 'sales') {
      return <SalesOrderTable contractId={contract.pk} defaultOutstanding={false} />;
    }

    return <PurchaseOrderTable contractId={contract.pk} defaultOutstanding={false} />;
  }, [contract]);

  const panels: PanelType[] = useMemo(
    () => [
      {
        name: 'detail',
        label: t`Contract Details`,
        icon: <IconInfoCircle />,
        content: detailsPanel
      },
      {
        name: 'linked-contracts',
        label:
          contract?.contract_type === 'sales'
            ? t`Linked Purchase Contracts`
            : t`Linked Sales Contract`,
        icon:
          contract?.contract_type === 'sales' ? (
            <IconFileDollar />
          ) : (
            <IconFileInvoice />
        ),
        content: relatedContractsPanel
      },
      {
        name: 'orders',
        label:
          contract?.contract_type === 'sales'
            ? t`Sales Orders`
            : t`Purchase Orders`,
        icon:
          contract?.contract_type === 'sales' ? (
            <IconTruckDelivery />
          ) : (
            <IconShoppingCart />
          ),
        content: relatedOrdersPanel
      },
      AttachmentPanel({
        model_type: ModelType.contract,
        model_id: contract?.pk,
        label: t`Contract Documents`
      }),
      NotesPanel({
        model_type: ModelType.contract,
        model_id: contract?.pk,
        has_note: !!contract?.notes
      })
    ],
    [contract, detailsPanel, relatedContractsPanel, relatedOrdersPanel]
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
          title={`${t`Contracts`}: ${contract?.reference ?? ''}`}
          subtitle={subtitle}
          icon={<IconFileDescription size={18} />}
          badges={badges}
          breadcrumbs={[{ name: t`Contracts`, url: '/contracts/' }]}
          lastCrumb={[
            {
              name: contract?.reference ?? t`Contracts`,
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
            <IconClipboardText size={14} /> {t`Purchase contracts in the table are filtered by this sales contract.`}
          </Text>
        )}
      </Stack>
    </InstanceDetail>
  );
}
