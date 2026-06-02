import { Switch } from '@mantine/core';
import { useEffect, useState } from 'react';

export function KeepFormOpenSwitch({
  onChange
}: { onChange?: (v: boolean) => void }) {
  const [keepOpen, setKeepOpen] = useState(false);

  useEffect(() => {
    onChange?.(keepOpen);
  }, [keepOpen]);

  return (
    <Switch
      checked={keepOpen}
      radius='lg'
      size='sm'
      label='Giữ form mở'
      description='Giữ form mở sau khi gửi dữ liệu'
      onChange={(e) => setKeepOpen(e.currentTarget.checked)}
    />
  );
}
