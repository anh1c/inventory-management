import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import { openContextModal } from '@mantine/modals';

import { UserRoles } from '@lib/enums/Roles';
import type { SettingsStateProps } from '@lib/types/Settings';
import type { UserStateProps } from '@lib/types/User';
import {
  IconBox,
  IconBuildingFactory2,
  IconClipboardText,
  IconDashboard,
  IconListDetails,
  IconPackages,
  IconShoppingCart,
  IconTruckDelivery
} from '@tabler/icons-react';
import type { ReactNode } from 'react';
import type { MenuLinkItem } from '../components/items/MenuLinks';
import { StylishText } from '../components/items/StylishText';

type NavTab = {
  name: string;
  title: string;
  icon: ReactNode;
  role?: UserRoles;
  roles?: UserRoles[];
};

export function getNavTabs(user: UserStateProps): NavTab[] {
  const navTabs: NavTab[] = [
    {
      name: 'home',
      title: t`Dashboard`,
      icon: <IconDashboard />
    },
    {
      name: 'part',
      title: t`Parts`,
      icon: <IconBox />,
      role: UserRoles.part
    },
    {
      name: 'stock',
      title: t`Kho`,
      icon: <IconPackages />,
      role: UserRoles.stock
    },
    {
      name: 'manufacturing',
      title: t`Manufacturing`,
      icon: <IconBuildingFactory2 />,
      role: UserRoles.build
    },
    {
      name: 'purchasing',
      title: t`Purchasing`,
      icon: <IconShoppingCart />,
      role: UserRoles.purchase_order
    },
    {
      name: 'sales',
      title: t`Sales`,
      icon: <IconTruckDelivery />,
      role: UserRoles.sales_order
    },
    {
      name: 'contracts',
      title: t`Contracts`,
      icon: <IconClipboardText />,
      roles: [UserRoles.sales_order, UserRoles.purchase_order]
    },
    {
      name: 'projects',
      title: t`Projects`,
      icon: <IconListDetails />,
      role: UserRoles.admin
    }
  ];

  return navTabs.filter((tab) => {
    if (tab.roles) return tab.roles.some((role) => user.hasViewRole(role));
    if (!tab.role) return true;
    return user.hasViewRole(tab.role);
  });
}

export const docLinks = {
  app: `${window.location.origin}/`,
  getting_started: `${window.location.origin}/`,
  api: `${window.location.origin}/api-doc/`,
  developer: `${window.location.origin}/settings/system/`,
  faq: `${window.location.origin}/settings/admin/`,
  github: `${window.location.origin}/`,
  errorcodes: `${window.location.origin}/api-doc/`
};

export function DocumentationLinks(): MenuLinkItem[] {
  return [
    {
      id: 'gettin-started',
      title: t`Getting Started`,
      link: docLinks.getting_started,
      external: true,
      description: t`Open the DTWare workspace`
    },
    {
      id: 'api',
      title: t`API Reference`,
      link: docLinks.api,
      external: true,
      description: t`Review API capabilities`
    },
    {
      id: 'developer',
      title: t`System Settings`,
      link: docLinks.developer,
      external: true,
      description: t`Configure the DTWare instance`
    },
    {
      id: 'faq',
      title: t`Support`,
      link: docLinks.faq,
      external: true,
      description: t`Open support and administration tools`
    },
    {
      id: 'github',
      title: t`Application`,
      link: docLinks.github,
      external: true,
      description: t`Return to DTWare`
    }
  ];
}

export function serverInfo() {
  return openContextModal({
    modal: 'info',
    title: (
      <StylishText size='xl'>
        <Trans>System Details</Trans>
      </StylishText>
    ),
    size: 'xl',
    innerProps: {}
  });
}

export function aboutInvenTree() {
  return openContextModal({
    modal: 'about',
    title: (
      <StylishText size='xl'>
        <Trans>About DTWare</Trans>
      </StylishText>
    ),
    size: 'xl',
    innerProps: {}
  });
}

export function licenseInfo() {
  return openContextModal({
    modal: 'license',
    title: (
      <StylishText size='xl'>
        <Trans>License Information</Trans>
      </StylishText>
    ),
    size: 'xl',
    innerProps: {}
  });
}

export function AboutLinks(
  settings: SettingsStateProps,
  user: UserStateProps
): MenuLinkItem[] {
  const base_items: MenuLinkItem[] = [
    {
      id: 'instance',
      title: t`System Details`,
      description: t`Deployment, version and runtime information`,
      icon: 'info',
      action: serverInfo
    },
    {
      id: 'licenses',
      title: t`License Information`,
      description: t`Third-party dependency license information`,
      icon: 'license',
      action: licenseInfo
    }
  ];

  // Restrict the about link if that setting is set
  if (user.isSuperuser() || !settings.isSet('INVENTREE_RESTRICT_ABOUT')) {
    base_items.push({
      id: 'about',
      title: t`About DTWare`,
      description: t`Product information for DTWare`,
      icon: 'info',
      action: aboutInvenTree
    });
  }
  return base_items;
}
