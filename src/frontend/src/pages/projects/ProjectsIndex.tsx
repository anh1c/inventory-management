import { t } from '@lingui/core/macro';
import { Alert, Stack, Text } from '@mantine/core';
import { IconInfoCircle, IconListDetails } from '@tabler/icons-react';

import { UserRoles } from '@lib/enums/Roles';
import PermissionDenied from '../../components/errors/PermissionDenied';
import { PageDetail } from '../../components/nav/PageDetail';
import { GlobalSettingList } from '../../components/settings/SettingList';
import { useGlobalSettingsState } from '../../states/SettingsStates';
import { useUserState } from '../../states/UserState';
import ProjectCodeTable from '../../tables/settings/ProjectCodeTable';

export default function ProjectsIndex() {
  const user = useUserState();
  const globalSettings = useGlobalSettingsState();
  const canViewProjects =
    user.isStaff() ||
    (!globalSettings.isSet('BUILDORDER_DISABLED', true) &&
      user.hasViewRole(UserRoles.build)) ||
    user.hasViewRole(UserRoles.purchase_order) ||
    user.hasViewRole(UserRoles.sales_order);

  if (!user.isLoggedIn() || !canViewProjects) {
    return <PermissionDenied />;
  }

  return (
    <Stack gap='sm'>
      <PageDetail
        title={t`Projects`}
        subtitle={t`Create, enable, and configure project codes used for contracts, purchase orders, and sales orders`}
        icon={<IconListDetails size={18} />}
      />
      <Alert color='blue' icon={<IconInfoCircle />}>
        <Text size='sm'>
          {t`Project codes group sales and purchase contracts and orders under the same project.`}
        </Text>
      </Alert>
      {user.isStaff() && <GlobalSettingList keys={['PROJECT_CODES_ENABLED']} />}
      <ProjectCodeTable />
    </Stack>
  );
}
