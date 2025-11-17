/**
 * Retorna a data de hoje às 00:00:00 em formato ISO
 * Usado para comparações consistentes de datas em queries
 */
export const getTodayStartOfDay = (): string => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today.toISOString().split('T')[0];
};

/**
 * Verifica se uma data é no futuro
 */
export const isFutureDate = (dateString: string | null): boolean => {
  if (!dateString) return false;
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const checkDate = new Date(dateString);
  checkDate.setHours(0, 0, 0, 0);
  
  return checkDate > today;
};

/**
 * Verifica se uma data é hoje ou no passado
 */
export const isTodayOrPast = (dateString: string | null): boolean => {
  if (!dateString) return true; // NULL considerado como "hoje ou passado"
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const checkDate = new Date(dateString);
  checkDate.setHours(0, 0, 0, 0);
  
  return checkDate <= today;
};
