import { ListItem } from "@/components/ui/ListItem";

type SettingRowProps = {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
  wrapDescription?: boolean;
};

export function SettingRow({
  icon,
  title,
  description,
  action,
  wrapDescription,
}: SettingRowProps) {
  return (
    <ListItem
      icon={icon}
      title={title}
      description={description}
      action={action}
      wrapDescription={wrapDescription}
    />
  );
}
