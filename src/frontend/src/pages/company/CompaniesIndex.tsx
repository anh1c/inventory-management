import { Trans } from '@lingui/react/macro';
import { t } from '@lingui/core/macro';
import { Alert, Stack, Text } from '@mantine/core';
import { IconHierarchy, IconInfoCircle } from '@tabler/icons-react';

import { UserRoles } from '@lib/enums/Roles';
import PermissionDenied from '../../components/errors/PermissionDenied';
import { PageDetail } from '../../components/nav/PageDetail';
import { useUserState } from '../../states/UserState';
import { CompanyTable } from '../../tables/company/CompanyTable';

export default function CompaniesIndex() {
  const user = useUserState();
  const canViewCompanies =
    user.isStaff() ||
    user.hasViewRole(UserRoles.purchase_order) ||
    user.hasViewRole(UserRoles.sales_order);

  if (!user.isLoggedIn() || !canViewCompanies) {
    return <PermissionDenied />;
  }

  return (
    <Stack gap='sm'>
      <PageDetail
        title={t`Internal Companies`}
        subtitle={t`Manage DTI subsidiaries and internal business units`}
        icon={<IconHierarchy size={18} />}
      />
      <Alert color='blue' icon={<IconInfoCircle />}>
        <Text size='sm'>
          <Trans>Create and update internal companies with representatives, positions, and parent companies. Select a row to open the existing company detail page.</Trans>
        </Text>
      </Alert>
      <CompanyTable
        companyType='internal'
        params={{ is_internal: true }}
        path='company'
        initialData={{ is_internal: true }}
        showInternalColumns
      />
    </Stack>
  );
}
