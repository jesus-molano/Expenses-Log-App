import { ListItem } from "@/components/ui/ListItem";

type SettingRowProps = {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
};

export function SettingRow({
  icon,
  title,
  description,
  action,
}: SettingRowProps) {
  return (
    <ListItem
      icon={icon}
      title={title}
      description={description}
      action={action}
    />
  );
}
