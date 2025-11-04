import { supabase } from '@/integrations/supabase/client';

interface QueuedUpdate {
  id: string;
  freightId: string;
  newStatus: string;
  userId: string;
  notes?: string;
  location?: { lat: number; lng: number };
  assignmentId?: string;
  timestamp: number;
  attempts: number;
}

const QUEUE_KEY = 'freight_status_updates_queue';
const MAX_ATTEMPTS = 5;

export class StatusUpdateQueue {
  private static getQueue(): QueuedUpdate[] {
    try {
      const stored = localStorage.getItem(QUEUE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }
  
  private static saveQueue(queue: QueuedUpdate[]): void {
    try {
      localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
    } catch (err) {
      console.error('[StatusUpdateQueue] Erro ao salvar queue:', err);
    }
  }
  
  static add(update: Omit<QueuedUpdate, 'id' | 'timestamp' | 'attempts'>): void {
    const queue = this.getQueue();
    queue.push({
      ...update,
      id: crypto.randomUUID(),
      timestamp: Date.now(),
      attempts: 0
    });
    this.saveQueue(queue);
    console.log('[StatusUpdateQueue] Update adicionado à fila:', update.freightId);
  }
  
  static async processQueue(): Promise<void> {
    const queue = this.getQueue();
    if (queue.length === 0) return;
    
    console.log(`[StatusUpdateQueue] Processando ${queue.length} updates pendentes...`);
    
    const updatedQueue: QueuedUpdate[] = [];
    
    for (const update of queue) {
      if (update.attempts >= MAX_ATTEMPTS) {
        console.warn('[StatusUpdateQueue] Update descartado após max tentativas:', update.freightId);
        continue;
      }
      
      try {
        const success = await this.retryUpdate(update);
        
        if (!success) {
          updatedQueue.push({
            ...update,
            attempts: update.attempts + 1
          });
        } else {
          console.log('[StatusUpdateQueue] Update sincronizado:', update.freightId);
        }
      } catch (err) {
        console.error('[StatusUpdateQueue] Erro ao processar:', err);
        updatedQueue.push({
          ...update,
          attempts: update.attempts + 1
        });
      }
    }
    
    this.saveQueue(updatedQueue);
  }
  
  private static async retryUpdate(update: QueuedUpdate): Promise<boolean> {
    try {
      // Atualizar frete
      const { error: freightError } = await supabase
        .from('freights')
        .update({ 
          status: update.newStatus as any,
          updated_at: new Date().toISOString() 
        })
        .eq('id', update.freightId);
      
      if (freightError) throw freightError;
      
      // Inserir histórico
      const { error: historyError } = await supabase
        .from('freight_status_history')
        .insert({
          freight_id: update.freightId,
          status: update.newStatus as any,
          changed_by: update.userId,
          notes: update.notes || `Status: ${update.newStatus}`
        } as any);
      
      if (historyError) throw historyError;
      
      // Inserir checkin se houver localização
      if (update.location?.lat && update.location?.lng) {
        await supabase
          .from('freight_checkins')
          .insert({
            freight_id: update.freightId,
            user_id: update.userId,
            location_lat: update.location.lat,
            location_lng: update.location.lng,
            checkin_type: update.newStatus,
            notes: update.notes
          } as any);
      }
      
      return true;
    } catch (err) {
      console.error('[StatusUpdateQueue] Erro no retry:', err);
      return false;
    }
  }
  
  static getPendingCount(): number {
    return this.getQueue().length;
  }
  
  static clear(): void {
    localStorage.removeItem(QUEUE_KEY);
  }
}

// Auto-processar queue ao carregar app e periodicamente
if (typeof window !== 'undefined') {
  setTimeout(() => StatusUpdateQueue.processQueue(), 5000);
  setInterval(() => StatusUpdateQueue.processQueue(), 120000);
}
