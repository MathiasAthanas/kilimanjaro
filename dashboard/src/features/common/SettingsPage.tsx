import { Bell, MonitorCog, Settings, SlidersHorizontal, UserRound } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { SelectField } from '../../components/forms/SelectField';
import { AdvancedIcon } from '../../components/icons/AdvancedIcon';
import { PageScaffold } from './PageScaffold';

export function SettingsPage() {
  return (
    <PageScaffold title="User Settings" description="Manage your school portal preferences and common workspace behavior.">
      <div className="mb-6 flex gap-8 border-b border-ks-line">
        <button className="flex items-center gap-2 -mb-px border-b-2 border-ks-blue pb-3 text-sm font-bold text-ks-blue"><Settings className="h-4 w-4" /> General</button>
        <Link className="flex items-center gap-2 -mb-px pb-3 text-sm font-bold text-ks-muted hover:text-ks-navy" to="/app/notifications"><Bell className="h-4 w-4" /> Notifications</Link>
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2 p-6">
          <h3 className="font-display text-2xl font-bold text-ks-navy">Workspace Preferences</h3>
          <div className="mt-6 grid gap-5 md:grid-cols-2">
            <SelectField label="Theme mode" options={[{ label: 'System', value: 'system' }, { label: 'Light', value: 'light' }, { label: 'Dark', value: 'dark' }]} />
            <SelectField label="Density" options={[{ label: 'Comfortable', value: 'comfortable' }, { label: 'Compact', value: 'compact' }]} />
            <SelectField label="Default landing workspace" options={[{ label: 'Role default', value: 'role' }, { label: 'Notifications', value: 'notifications' }, { label: 'Reports', value: 'reports' }]} />
            <SelectField label="Table row density" options={[{ label: 'Comfortable', value: 'comfortable' }, { label: 'Ledger', value: 'ledger' }]} />
          </div>
          <Button className="mt-6">Save settings</Button>
        </Card>
        <Card className="p-6">
          <AdvancedIcon icon={UserRound} tone="gold" />
          <h4 className="mt-4 font-display text-xl font-bold text-ks-navy">Staff Profile</h4>
          <p className="mt-2 text-sm text-ks-muted">Profile data is synced from the secure auth service.</p>
          <Link to="/app/profile"><Button className="mt-5 w-full" variant="secondary">View Full Profile</Button></Link>
          <Link to="/app/security"><Button className="mt-3 w-full" variant="quiet">Change Password</Button></Link>
        </Card>
      </div>
      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <Card className="p-6"><AdvancedIcon icon={MonitorCog} /><h3 className="mt-4 font-display text-xl font-bold text-ks-navy">Accessibility</h3><p className="mt-2 text-sm text-ks-muted">Focus rings, reduced motion support and readable density are enabled.</p></Card>
        <Card className="p-6"><AdvancedIcon icon={SlidersHorizontal} tone="emerald" /><h3 className="mt-4 font-display text-xl font-bold text-ks-navy">Settings Updated</h3><Badge tone="emerald">Local persistence ready</Badge></Card>
      </div>
    </PageScaffold>
  );
}
