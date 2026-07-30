import { t } from '@lingui/core/macro';
import type {
  ApiFormAdjustFilterType,
  ApiFormFieldSet
} from '@lib/types/Forms';
import {
  IconAt,
  IconCurrencyDollar,
  IconGlobe,
  IconHash,
  IconLink,
  IconNote,
  IconPackage,
  IconPhone
} from '@tabler/icons-react';
import { useMemo } from 'react';

/**
 * Field set for SupplierPart instance
 */
export function useSupplierPartFields({
  manufacturerId,
  manufacturerPartId,
  partId
}: {
  manufacturerId?: number;
  manufacturerPartId?: number;
  partId?: number;
}) {
  return useMemo(() => {
    const fields: ApiFormFieldSet = {
      part: {
        value: partId,
        disabled: !!partId,
        filters: {
          part: partId,
          purchaseable: true,
          active: true
        }
      },
      manufacturer_part: {
        value: manufacturerPartId,
        autoFill: true,
        filters: {
          manufacturer: manufacturerId,
          part_detail: true,
          manufacturer_detail: true
        },
        adjustFilters: (adjust: ApiFormAdjustFilterType) => {
          return {
            ...adjust.filters,
            part: adjust.data.part
          };
        }
      },
      supplier: {
        filters: {
          active: true,
          is_supplier: true
        }
      },
      SKU: {
        icon: <IconHash />
      },
      description: {},
      link: {
        icon: <IconLink />
      },
      note: {
        icon: <IconNote />
      },
      pack_quantity: {},
      packaging: {
        icon: <IconPackage />
      },
      primary: {
        label: t`Preferred`,
        description: t`Mark this supplier part as preferred for the linked part`
      },
      active: {
        label: t`Active`,
        description: t`This supplier part is active for use`
      }
    };

    return fields;
  }, [manufacturerId, manufacturerPartId, partId]);
}

export function useManufacturerPartFields() {
  return useMemo(() => {
    const fields: ApiFormFieldSet = {
      part: {},
      manufacturer: {
        filters: {
          active: true,
          is_manufacturer: true
        }
      },
      MPN: {},
      description: {},
      link: {}
    };

    return fields;
  }, []);
}

/**
 * Field set for editing a company instance
 */
export function companyFields(): ApiFormFieldSet {
  return {
    name: {
      label: t`Company Name`,
      description: t`Business or partner name`
    },
    description: {
      label: t`Description`,
      description: t`Short company description`
    },
    website: {
      label: 'Website',
      description: t`Company website`,
      icon: <IconGlobe />
    },
    currency: {
      label: t`Currency`,
      description: t`Default currency for transactions with this company`,
      icon: <IconCurrencyDollar />
    },
    phone: {
      label: t`Phone Number`,
      description: t`Contact phone number`,
      icon: <IconPhone />
    },
    email: {
      label: 'Email',
      description: t`Contact email address`,
      icon: <IconAt />
    },
    tax_id: {
      label: t`Tax Code`,
      description: t`Company tax code`
    },
    representative: {
      label: t`Representative`,
      description: t`Legal representative of the company`
    },
    representative_position: {
      label: t`Representative Position`,
      description: t`Title or position of the legal representative`
    },
    is_supplier: {
      label: t`Is Supplier`,
      description: t`Does this company provide goods or services to inventory?`
    },
    is_manufacturer: {
      label: t`Is Manufacturer`,
      description: t`Does this company manufacture goods or components?`
    },
    is_customer: {
      label: t`Is Customer`,
      description: t`Does this company buy from the system?`
    },
    is_internal: {
      label: t`Is Internal Company`,
      description: t`Does this company belong to the group that owns the system?`
    },
    parent_company: {
      label: t`Parent Company`,
      description: t`Parent company managing subsidiaries`
    },
    active: {
      label: t`Active`,
      description: t`This company is active in the system`
    }
  };
}

export function internalCompanyFields(): ApiFormFieldSet {
  return {
    name: {
      label: t`Company Name`,
      description: t`Internal company name`
    },
    description: {
      label: t`Description`,
      description: t`Short internal company description`
    },
    website: {
      label: 'Website',
      description: t`Company website`,
      icon: <IconGlobe />
    },
    currency: {
      label: t`Currency`,
      description: t`Default currency of the internal company`,
      icon: <IconCurrencyDollar />
    },
    phone: {
      label: t`Phone Number`,
      description: t`Contact phone number`,
      icon: <IconPhone />
    },
    email: {
      label: 'Email',
      description: t`Contact email address`,
      icon: <IconAt />
    },
    tax_id: {
      label: t`Tax Code`,
      description: t`Company tax code`
    },
    representative: {
      label: t`Representative`,
      description: t`Legal representative of the company`
    },
    representative_position: {
      label: t`Representative Position`,
      description: t`Title or position of the legal representative`
    },
    is_supplier: {
      label: t`Is Supplier`,
      description: t`Does this company provide goods or services to inventory?`,
      value: false
    },
    is_manufacturer: {
      label: t`Is Manufacturer`,
      description: t`Does this company manufacture goods or components?`
    },
    is_customer: {
      label: t`Is Customer`,
      description: t`Does this company buy from the system?`
    },
    is_internal: {
      label: t`Is Internal Company`,
      description: t`Does this company belong to the group that owns the system?`,
      disabled: true,
      value: true
    },
    parent_company: {
      label: t`Parent Company`,
      description: t`Parent company managing subsidiaries`
    },
    active: {
      label: t`Active`,
      description: t`This company is active in the system`
    }
  };
}
