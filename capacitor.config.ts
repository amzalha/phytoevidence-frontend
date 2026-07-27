import type { CapacitorConfig } from '@capacitor/cli';
const config: CapacitorConfig = {
  appId: 'ma.phyto.evidence',
  appName: 'PhytoEvidence',
  webDir: 'dist',
  plugins: { CapacitorHttp: { enabled: true } }
};
export default config;
