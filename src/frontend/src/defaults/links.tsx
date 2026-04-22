import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/react/macro';
import { openContextModal } from '@mantine/modals';

import { UserRoles } from '@lib/enums/Roles';
import type { SettingsStateProps } from '@lib/types/Settings';
import type { UserStateProps } from '@lib/types/User';
import {
  IconBox,
  IconBuildingFactory2,
  IconDashboard,
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
};

const dtwareText = (value: string) => value.replaceAll('InvenTree', 'DTWare');

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
      title: t`Stock`,
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
    }
  ];

  return navTabs.filter((tab) => {
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
      description: dtwareText(t`Getting started with InvenTree`)
    },
    {
      id: 'api',
      title: t`Documentation`,
      link: docLinks.api,
      external: true,
      description: t`Documentation`
    },
    {
      id: 'developer',
      title: t`Documentation`,
      link: docLinks.developer,
      external: true,
      description: t`Documentation`
    },
    {
      id: 'faq',
      title: t`Submit Bug Report`,
      link: docLinks.faq,
      external: true,
      description: t`Submit Bug Report`
    },
    {
      id: 'github',
      title: t`Source Code`,
      link: docLinks.github,
      external: true,
      description: t`Source Code`
    }
  ];
}

export function serverInfo() {
  return openContextModal({
    modal: 'info',
    title: (
      <StylishText size='xl'>
        <Trans>System Information</Trans>
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
        {dtwareText(t`About InvenTree`)}
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
      title: t`System Information`,
      description: dtwareText(t`About this InvenTree instance`),
      icon: 'info',
      action: serverInfo
    },
    {
      id: 'licenses',
      title: t`License Information`,
      description: dtwareText(t`Licenses for dependencies of the InvenTree software`),
      icon: 'license',
      action: licenseInfo
    }
  ];

  // Restrict the about link if that setting is set
  if (user.isSuperuser() || !settings.isSet('INVENTREE_RESTRICT_ABOUT')) {
    base_items.push({
      id: 'about',
      title: dtwareText(t`About InvenTree`),
      description: dtwareText(t`About the InvenTree Project`),
      icon: 'info',
      action: aboutInvenTree
    });
  }
  return base_items;
}
