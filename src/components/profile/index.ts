/**
 * Profile Components Index
 * 
 * Exporta todos os componentes de perfil para uso no app.
 */

// Header com foto e info básica
export { ProfileHeader } from './ProfileHeader';

// Cards de informações
export { 
  ProfileInfoCard, 
  personalInfoFields, 
  producerFields, 
  driverFields, 
  emergencyFields 
} from './ProfileInfoCard';

// Card de estatísticas e avaliações
export { ProfileStatsCard } from './ProfileStatsCard';

// Card de endereço
export { ProfileAddressCard } from './ProfileAddressCard';

// Zona de perigo
export { ProfileDangerZone } from './ProfileDangerZone';

// Componentes legados (mantidos para retrocompatibilidade)
export { ProfileEditCard } from './ProfileEditCard';
export { ProfileFormSection } from './ProfileFormSection';
export { ProfileFormField } from './ProfileFormField';
export { PublicProfileModal } from './PublicProfileModal';
