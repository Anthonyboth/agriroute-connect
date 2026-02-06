/**
 * src/components/security/index.ts
 *
 * Barrel export para componentes de segurança obrigatórios.
 *
 * USO OBRIGATÓRIO:
 *   import { FreightActionButton, SafePrice, SafeStatusBadge } from '@/components/security';
 *
 * PROIBIDO:
 *   - formatBRL direto para preços de frete/proposta → use SafePrice
 *   - Badge com status cru → use SafeStatusBadge
 *   - Button direto para ações críticas de frete → use FreightActionButton
 */

export { FreightActionButton } from './FreightActionButton';
export { SafePrice } from './SafePrice';
export { SafeStatusBadge } from './SafeStatusBadge';
