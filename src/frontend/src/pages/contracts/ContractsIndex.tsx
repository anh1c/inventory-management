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
  IconClipboardText,
  IconInfoCircle,
  IconShoppingCart,
  IconTruckDelivery
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
        {t`Chọn một hợp đồng bán để xem và tạo các hợp đồng mua liên kết.`}
      </Alert>
    );
  }

  return (
    <SelectionCard
      title={t`Hợp đồng bán đang chọn`}
      description={t`Mỗi hợp đồng bán có thể liên kết với nhiều hợp đồng mua cùng mã dự án.`}
    >
      <Stack gap='xs'>
        <Text fw={600}>{contract.reference}</Text>
        {contract.title && <Text>{contract.title}</Text>}
        <Text size='sm' c='dimmed'>
          {t`Đơn bán`}: {contract.sales_order_count ?? 0} | {t`Hợp đồng mua`}:{' '}
          {contract.purchase_contract_count ?? 0}
        </Text>
        {contract.project_code_detail && (
          <Text size='sm'>
            {t`Mã dự án`}: {contract.project_code_detail.code}
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
      title={t`Hợp đồng mua liên kết`}
      description={t`Xem nhanh các hợp đồng mua được map trực tiếp với hợp đồng bán đang chọn.`}
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
        title: t`Mã tham chiếu`,
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
        title: t`Loại hợp đồng`,
        render: (contract: ContractRecord) => (
          <Badge color='blue'>
            {contract.contract_type === 'sales'
              ? t`Hợp đồng bán`
              : contract.contract_type}
          </Badge>
        )
      },
      {
        accessor: 'title',
        title: t`Tiêu đề`,
        render: (contract: ContractRecord) => contract.title ?? '-'
      },
      {
        accessor: 'project_code_detail.code',
        title: t`Mã dự án`,
        render: (contract: ContractRecord) => contract.project_code_detail?.code ?? '-'
      }
    ],
    [navigate]
  );

  if (!selectedPurchaseContract) {
    return (
      <Alert color='blue' icon={<IconInfoCircle />}>
        {t`Chọn một hợp đồng mua để xem hợp đồng bán được liên kết.`}
      </Alert>
    );
  }

  const salesContract = selectedPurchaseContract.sales_contract_detail;

  if (!salesContract) {
    return (
      <Alert color='yellow' icon={<IconInfoCircle />}>
        {t`Hợp đồng mua này chưa được liên kết với hợp đồng bán.`}
      </Alert>
    );
  }

  return (
    <SelectionCard
      title={t`Hợp đồng bán liên kết`}
      description={t`Thông tin hợp đồng bán được map trực tiếp với hợp đồng mua đang chọn.`}
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
        label: t`Hợp đồng bán`,
        icon: <IconTruckDelivery />,
        content: (
          <Stack gap='sm'>
            <SelectionCard
              title={t`Danh sách hợp đồng bán`}
              description={t`Hợp đồng là đối tượng riêng, có mã dự án và có thể chứa nhiều đơn bán.`}
            >
              <Text size='sm' c='dimmed'>
                {t`Chọn một hợp đồng bán để xem ngay các hợp đồng mua được map bên dưới danh sách này.`}
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
        label: t`Hợp đồng mua`,
        icon: <IconShoppingCart />,
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
        title={t`Hợp đồng`}
        subtitle={t`Quản lý hợp đồng bán, hợp đồng mua, mã dự án và đơn hàng liên quan`}
        icon={<IconClipboardText />}
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
