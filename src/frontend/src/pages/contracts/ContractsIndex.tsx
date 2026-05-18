import { t } from '@lingui/core/macro';
import {
  Alert,
  Anchor,
  Badge,
  Group,
  Paper,
  Stack,
  Table,
  Text,
  Title
} from '@mantine/core';
import {
  IconContract,
  IconFileDollar,
  IconFileInvoice,
  IconInfoCircle,
} from '@tabler/icons-react';
import { type ReactNode, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { ModelType } from '@lib/enums/ModelType';
import { UserRoles } from '@lib/enums/Roles';
import { getDetailUrl, navigateToLink } from '@lib/functions/Navigation';
import PermissionDenied from '../../components/errors/PermissionDenied';
import { PageDetail } from '../../components/nav/PageDetail';
import type { PanelType } from '../../components/panels/Panel';
import { PanelGroup } from '../../components/panels/PanelGroup';
import { useUserState } from '../../states/UserState';
import { ContractTable } from '../../tables/contract/ContractTable';

type ContractRecord = {
  pk: number;
  reference?: string;
  contract_type?: string;
  title?: string;
  project_code?: number;
  project_code_detail?: { code?: string };
  sales_order_count?: number;
  purchase_order_count?: number;
  purchase_contract_count?: number;
  sales_contract_detail?: ContractRecord | null;
  [key: string]: unknown;
};

function SelectionCard({
  title,
  description,
  children
}: Readonly<{
  title: string;
  description?: string;
  children: ReactNode;
}>) {
  return (
    <Paper p='sm' radius='xs' shadow='xs'>
      <Stack gap='xs'>
        <Group gap='xs'>
          <IconInfoCircle size={18} />
          <Title order={4}>{title}</Title>
        </Group>
        {description && (
          <Text size='sm' c='dimmed'>
            {description}
          </Text>
        )}
        {children}
      </Stack>
    </Paper>
  );
}

function SelectedSalesContract({
  contract
}: Readonly<{ contract?: ContractRecord | null }>) {
  if (!contract) {
    return (
      <Alert color='blue' icon={<IconInfoCircle />}>
        {t`Select a sales contract to view and create linked purchase contracts.`}
      </Alert>
    );
  }

  return (
    <SelectionCard
      title={t`Selected Sales Contract`}
      description={t`Each sales contract can link to multiple purchase contracts with the same project code.`}
    >
      <Stack gap='xs'>
        <Text fw={600}>{contract.reference}</Text>
        {contract.title && <Text>{contract.title}</Text>}
        <Text size='sm' c='dimmed'>
          {t`Sales Orders`}: {contract.sales_order_count ?? 0} | {t`Purchase Contract`}:{' '}
          {contract.purchase_contract_count ?? 0}
        </Text>
        {contract.project_code_detail && (
          <Text size='sm'>
            {t`Project Code`}: {contract.project_code_detail.code}
          </Text>
        )}
      </Stack>
    </SelectionCard>
  );
}

function LinkedPurchaseContracts({
  selectedSalesContract
}: Readonly<{ selectedSalesContract?: ContractRecord | null }>) {
  return (
    <SelectionCard
      title={t`Linked Purchase Contracts`}
      description={t`Quickly view purchase contracts mapped directly to the selected sales contract.`}
    >
      <Stack gap='sm'>
        <SelectedSalesContract contract={selectedSalesContract} />
        {selectedSalesContract && (
          <ContractTable
            contractType='purchase'
            salesContract={selectedSalesContract}
            salesContractId={selectedSalesContract?.pk}
          />
        )}
      </Stack>
    </SelectionCard>
  );
}

function LinkedSalesContract({
  selectedPurchaseContract
}: Readonly<{ selectedPurchaseContract?: ContractRecord | null }>) {
  const navigate = useNavigate();
  const columns = useMemo(
    () => [
      {
        accessor: 'reference',
        title: t`Reference`,
        render: (contract: ContractRecord) => {
          const detailUrl = getDetailUrl(ModelType.contract, contract.pk);

          return (
            <Anchor
              href={detailUrl}
              onClick={(event) => navigateToLink(detailUrl, navigate, event)}
            >
              {contract.reference}
            </Anchor>
          );
        }
      },
      {
        accessor: 'contract_type',
        title: t`Contract Type`,
        render: (contract: ContractRecord) => (
          <Badge color='blue'>
            {contract.contract_type === 'sales'
              ? t`Sales Contract`
              : contract.contract_type}
          </Badge>
        )
      },
      {
        accessor: 'title',
        title: t`Title`,
        render: (contract: ContractRecord) => contract.title ?? '-'
      },
      {
        accessor: 'project_code_detail.code',
        title: t`Project Code`,
        render: (contract: ContractRecord) => contract.project_code_detail?.code ?? '-'
      }
    ],
    [navigate]
  );

  if (!selectedPurchaseContract) {
    return (
      <Alert color='blue' icon={<IconInfoCircle />}>
        {t`Select a purchase contract to view its linked sales contract.`}
      </Alert>
    );
  }

  const salesContract = selectedPurchaseContract.sales_contract_detail;

  if (!salesContract) {
    return (
      <Alert color='yellow' icon={<IconInfoCircle />}>
        {t`This purchase contract is not linked to a sales contract.`}
      </Alert>
    );
  }

  return (
    <SelectionCard
      title={t`Linked Sales Contract`}
      description={t`Sales contract information mapped directly to the selected purchase contract.`}
    >
      <Table withTableBorder withColumnBorders striped highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            {columns.map((column) => (
              <Table.Th key={column.accessor}>{column.title}</Table.Th>
            ))}
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          <Table.Tr>
            {columns.map((column) => (
              <Table.Td key={column.accessor}>{column.render(salesContract)}</Table.Td>
            ))}
          </Table.Tr>
        </Table.Tbody>
      </Table>
    </SelectionCard>
  );
}

export default function ContractsIndex() {
  const user = useUserState();
  const [selectedSalesContract, setSelectedSalesContract] =
    useState<ContractRecord | null>(null);
  const [selectedPurchaseContract, setSelectedPurchaseContract] =
    useState<ContractRecord | null>(null);

  const canViewContracts =
    user.hasViewRole(UserRoles.sales_order) ||
    user.hasViewRole(UserRoles.purchase_order);

  const panels: PanelType[] = useMemo(
    () => [
      {
        name: 'sales-contracts',
        label: t`Sales Contract`,
        icon: <IconFileInvoice />,
        content: (
          <Stack gap='sm'>
            <SelectionCard
              title={t`Sales Contract List`}
              description={t`A contract is a separate record with a project code and can include multiple sales orders.`}
            >
              <Text size='sm' c='dimmed'>
                {t`Select a sales contract to immediately view mapped purchase contracts below this list.`}
              </Text>
            </SelectionCard>
            <ContractTable
              contractType='sales'
              onSelectContract={setSelectedSalesContract}
              selectedContractId={selectedSalesContract?.pk}
            />
            <LinkedPurchaseContracts
              selectedSalesContract={selectedSalesContract}
            />
          </Stack>
        )
      },
      {
        name: 'purchase-contracts',
        label: t`Purchase Contract`,
        icon: <IconFileDollar />,
        content: (
          <Stack gap='sm'>
            <ContractTable
              contractType='purchase'
              onSelectContract={setSelectedPurchaseContract}
              selectedContractId={selectedPurchaseContract?.pk}
            />
            <LinkedSalesContract
              selectedPurchaseContract={selectedPurchaseContract}
            />
          </Stack>
        )
      }
    ],
    [selectedPurchaseContract, selectedSalesContract]
  );

  if (!user.isLoggedIn() || !canViewContracts) {
    return <PermissionDenied />;
  }

  return (
    <Stack>
      <PageDetail
        title={t`Contracts`}
        subtitle={t`Manage sales contracts, purchase contracts, project codes, and related orders`}
        icon={<IconContract />}
      />
      <PanelGroup
        pageKey='contracts-index'
        panels={panels}
        model='contract'
        id={null}
      />
    </Stack>
  );
}
