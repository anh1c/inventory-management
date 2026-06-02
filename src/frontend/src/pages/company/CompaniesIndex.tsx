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
        title='Công ty nội bộ'
        subtitle='Quản lý các công ty con và đơn vị nội bộ của DTI'
        icon={<IconHierarchy size={18} />}
      />
      <Alert color='blue' icon={<IconInfoCircle />}>
        <Text size='sm'>
          Tạo và cập nhật công ty nội bộ với người đại diện, chức vụ và công ty mẹ. Chọn một dòng để mở trang chi tiết công ty hiện có.
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
