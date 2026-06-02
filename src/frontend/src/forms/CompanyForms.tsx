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
        label: 'Ưu tiên',
        description: 'Đánh dấu đây là mã hàng nhà cung cấp ưu tiên cho vật tư liên kết'
      },
      active: {
        label: 'Hoạt động',
        description: 'Mã hàng nhà cung cấp này còn hiệu lực sử dụng'
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
      label: 'Tên công ty',
      description: 'Tên doanh nghiệp hoặc đối tác'
    },
    description: {
      label: 'Mô tả',
      description: 'Thông tin mô tả ngắn về công ty'
    },
    website: {
      label: 'Website',
      description: 'Trang web của công ty',
      icon: <IconGlobe />
    },
    currency: {
      label: 'Tiền tệ',
      description: 'Tiền tệ mặc định khi giao dịch với công ty này',
      icon: <IconCurrencyDollar />
    },
    phone: {
      label: 'Số điện thoại',
      description: 'Số điện thoại liên hệ',
      icon: <IconPhone />
    },
    email: {
      label: 'Email',
      description: 'Địa chỉ email liên hệ',
      icon: <IconAt />
    },
    tax_id: {
      label: 'Mã số thuế',
      description: 'Mã số thuế của công ty'
    },
    representative: {
      label: 'Người đại diện',
      description: 'Người đại diện pháp lý của công ty'
    },
    representative_position: {
      label: 'Chức vụ người đại diện',
      description: 'Chức danh hoặc vị trí của người đại diện pháp lý'
    },
    is_supplier: {
      label: 'Là nhà cung cấp',
      description: 'Công ty này có cung cấp hàng hóa hoặc dịch vụ cho kho?'
    },
    is_manufacturer: {
      label: 'Là nhà sản xuất',
      description: 'Công ty này có sản xuất hàng hóa hoặc linh kiện?'
    },
    is_customer: {
      label: 'Là khách hàng',
      description: 'Công ty này có mua hàng từ hệ thống?'
    },
    is_internal: {
      label: 'Là công ty nội bộ',
      description: 'Công ty này thuộc nhóm công ty sở hữu hệ thống?'
    },
    parent_company: {
      label: 'Công ty mẹ',
      description: 'Công ty mẹ quản lý các công ty con'
    },
    active: {
      label: 'Hoạt động',
      description: 'Công ty này còn hiệu lực sử dụng trong hệ thống?'
    }
  };
}

export function internalCompanyFields(): ApiFormFieldSet {
  return {
    name: {
      label: 'Tên công ty',
      description: 'Tên công ty nội bộ'
    },
    description: {
      label: 'Mô tả',
      description: 'Thông tin mô tả ngắn về công ty nội bộ'
    },
    website: {
      label: 'Website',
      description: 'Trang web của công ty',
      icon: <IconGlobe />
    },
    currency: {
      label: 'Tiền tệ',
      description: 'Tiền tệ mặc định của công ty nội bộ',
      icon: <IconCurrencyDollar />
    },
    phone: {
      label: 'Số điện thoại',
      description: 'Số điện thoại liên hệ',
      icon: <IconPhone />
    },
    email: {
      label: 'Email',
      description: 'Địa chỉ email liên hệ',
      icon: <IconAt />
    },
    tax_id: {
      label: 'Mã số thuế',
      description: 'Mã số thuế của công ty'
    },
    representative: {
      label: 'Người đại diện',
      description: 'Người đại diện pháp lý của công ty'
    },
    representative_position: {
      label: 'Chức vụ người đại diện',
      description: 'Chức danh hoặc vị trí của người đại diện pháp lý'
    },
    is_supplier: {
      label: 'Là nhà cung cấp',
      description: 'Công ty này có cung cấp hàng hóa hoặc dịch vụ cho kho?',
      value: false
    },
    is_manufacturer: {
      label: 'Là nhà sản xuất',
      description: 'Công ty này có sản xuất hàng hóa hoặc linh kiện?'
    },
    is_customer: {
      label: 'Là khách hàng',
      description: 'Công ty này có mua hàng từ hệ thống?'
    },
    is_internal: {
      label: 'Là công ty nội bộ',
      description: 'Công ty này thuộc nhóm công ty sở hữu hệ thống?',
      disabled: true,
      value: true
    },
    parent_company: {
      label: 'Công ty mẹ',
      description: 'Công ty mẹ quản lý các công ty con'
    },
    active: {
      label: 'Hoạt động',
      description: 'Công ty này còn hiệu lực sử dụng trong hệ thống?'
    }
  };
}
