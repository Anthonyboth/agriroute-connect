/**
 * Hook para formulários com validação, estado e submit seguro
 * Centraliza lógica comum de formulários
 */

import { useState, useCallback, useRef, useMemo } from 'react';
import { toast } from '@/hooks/use-toast';
import { z } from 'zod';

interface FormField {
  value: any;
  error: string | null;
  touched: boolean;
  dirty: boolean;
}

interface FormState<T extends Record<string, any>> {
  fields: { [K in keyof T]: FormField };
  isValid: boolean;
  isDirty: boolean;
  isSubmitting: boolean;
  submitCount: number;
  errors: Partial<Record<keyof T, string>>;
}

interface FormOptions<T extends Record<string, any>> {
  /** Valores iniciais */
  initialValues: T;
  /** Schema Zod para validação */
  validationSchema?: z.ZodSchema<T>;
  /** Função de validação customizada */
  validate?: (values: T) => Partial<Record<keyof T, string>> | null;
  /** Callback de submit */
  onSubmit: (values: T) => Promise<void>;
  /** Mostrar toast de erro */
  showErrorToast?: boolean;
  /** Mensagem de sucesso */
  successMessage?: string;
  /** Reset após submit bem sucedido */
  resetOnSuccess?: boolean;
  /** Cooldown entre submits em ms */
  submitCooldownMs?: number;
}

interface FormResult<T extends Record<string, any>> {
  /** Estado atual do formulário */
  state: FormState<T>;
  /** Valores atuais */
  values: T;
  /** Atualizar um campo */
  setValue: <K extends keyof T>(field: K, value: T[K]) => void;
  /** Atualizar múltiplos campos */
  setValues: (values: Partial<T>) => void;
  /** Marcar campo como touched */
  setTouched: (field: keyof T) => void;
  /** Validar formulário */
  validateForm: () => boolean;
  /** Validar campo específico */
  validateField: (field: keyof T) => string | null;
  /** Submit do formulário */
  handleSubmit: (e?: React.FormEvent) => Promise<void>;
  /** Reset do formulário */
  reset: (newValues?: Partial<T>) => void;
  /** Obter props para input */
  getFieldProps: (field: keyof T) => {
    value: any;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onBlur: () => void;
    name: string;
  };
  /** Obter erro de um campo */
  getFieldError: (field: keyof T) => string | null;
  /** Se um campo tem erro e foi tocado */
  hasFieldError: (field: keyof T) => boolean;
}

export function useForm<T extends Record<string, any>>(
  options: FormOptions<T>
): FormResult<T> {
  const {
    initialValues,
    validationSchema,
    validate,
    onSubmit,
    showErrorToast = true,
    successMessage,
    resetOnSuccess = false,
    submitCooldownMs = 2000,
  } = options;

  const initialFieldsRef = useRef<FormState<T>['fields']>(
    createInitialFields(initialValues)
  );
  
  const [fields, setFields] = useState<FormState<T>['fields']>(
    () => createInitialFields(initialValues)
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitCount, setSubmitCount] = useState(0);
  const lastSubmitRef = useRef(0);

  function createInitialFields(values: T): FormState<T>['fields'] {
    const result = {} as FormState<T>['fields'];
    for (const key in values) {
      result[key] = {
        value: values[key],
        error: null,
        touched: false,
        dirty: false,
      };
    }
    return result;
  }

  const values = useMemo(() => {
    const result = {} as T;
    for (const key in fields) {
      result[key] = fields[key].value;
    }
    return result;
  }, [fields]);

  const errors = useMemo(() => {
    const result = {} as Partial<Record<keyof T, string>>;
    for (const key in fields) {
      if (fields[key].error) {
        result[key] = fields[key].error!;
      }
    }
    return result;
  }, [fields]);

  const isDirty = useMemo(() => {
    return Object.values(fields).some((f) => (f as FormField).dirty);
  }, [fields]);

  const isValid = useMemo(() => {
    return Object.values(fields).every((f) => !(f as FormField).error);
  }, [fields]);

  const validateField = useCallback((field: keyof T): string | null => {
    const value = fields[field]?.value;

    // Validação com Zod
    if (validationSchema) {
      try {
        const partialSchema = (validationSchema as any).pick?.({ [field]: true });
        if (partialSchema) {
          partialSchema.parse({ [field]: value });
        }
      } catch (error) {
        if (error instanceof z.ZodError) {
          const fieldError = error.errors.find(e => e.path[0] === field);
          if (fieldError) {
            return fieldError.message;
          }
        }
      }
    }

    // Validação customizada
    if (validate) {
      const customErrors = validate(values);
      if (customErrors && customErrors[field]) {
        return customErrors[field]!;
      }
    }

    return null;
  }, [fields, validationSchema, validate, values]);

  const validateForm = useCallback((): boolean => {
    let hasErrors = false;
    const newFields = { ...fields };

    for (const key in fields) {
      const error = validateField(key as keyof T);
      newFields[key] = {
        ...newFields[key],
        error,
        touched: true,
      };
      if (error) hasErrors = true;
    }

    setFields(newFields);
    return !hasErrors;
  }, [fields, validateField]);

  const setValue = useCallback(<K extends keyof T>(field: K, value: T[K]) => {
    setFields(prev => ({
      ...prev,
      [field]: {
        ...prev[field],
        value,
        dirty: value !== initialFieldsRef.current[field]?.value,
        error: null, // Limpar erro ao editar
      },
    }));
  }, []);

  const setValues = useCallback((newValues: Partial<T>) => {
    setFields(prev => {
      const updated = { ...prev };
      for (const key in newValues) {
        updated[key] = {
          ...updated[key],
          value: newValues[key],
          dirty: newValues[key] !== initialFieldsRef.current[key]?.value,
          error: null,
        };
      }
      return updated;
    });
  }, []);

  const setTouched = useCallback((field: keyof T) => {
    setFields(prev => ({
      ...prev,
      [field]: {
        ...prev[field],
        touched: true,
      },
    }));
  }, []);

  const reset = useCallback((newValues?: Partial<T>) => {
    const resetValues = newValues 
      ? { ...initialValues, ...newValues }
      : initialValues;
    
    const newFields = createInitialFields(resetValues);
    initialFieldsRef.current = newFields;
    setFields(newFields);
    setSubmitCount(0);
  }, [initialValues]);

  const handleSubmit = useCallback(async (e?: React.FormEvent) => {
    e?.preventDefault();

    // Verificar cooldown
    const now = Date.now();
    if (now - lastSubmitRef.current < submitCooldownMs) {
      console.log('[useForm] Submit bloqueado - cooldown');
      return;
    }

    // Verificar se já está submetendo
    if (isSubmitting) {
      console.log('[useForm] Submit bloqueado - já em execução');
      return;
    }

    // Validar
    if (!validateForm()) {
      if (showErrorToast) {
        toast({
          title: 'Erro de validação',
          description: 'Por favor, corrija os erros no formulário',
          variant: 'destructive',
        });
      }
      return;
    }

    lastSubmitRef.current = now;
    setIsSubmitting(true);
    setSubmitCount(prev => prev + 1);

    try {
      await onSubmit(values);
      
      if (successMessage) {
        toast({
          title: 'Sucesso',
          description: successMessage,
        });
      }

      if (resetOnSuccess) {
        reset();
      }
    } catch (error) {
      console.error('[useForm] Erro no submit:', error);
      
      if (showErrorToast) {
        toast({
          title: 'Erro',
          description: error instanceof Error ? error.message : 'Erro ao enviar formulário',
          variant: 'destructive',
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  }, [isSubmitting, validateForm, onSubmit, values, showErrorToast, successMessage, resetOnSuccess, reset, submitCooldownMs]);

  const getFieldProps = useCallback((field: keyof T) => ({
    value: fields[field]?.value ?? '',
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
      setValue(field, e.target.value as T[keyof T]);
    },
    onBlur: () => {
      setTouched(field);
      const error = validateField(field);
      if (error) {
        setFields(prev => ({
          ...prev,
          [field]: { ...prev[field], error },
        }));
      }
    },
    name: String(field),
  }), [fields, setValue, setTouched, validateField]);

  const getFieldError = useCallback((field: keyof T): string | null => {
    return fields[field]?.touched ? fields[field]?.error : null;
  }, [fields]);

  const hasFieldError = useCallback((field: keyof T): boolean => {
    return fields[field]?.touched && !!fields[field]?.error;
  }, [fields]);

  const state: FormState<T> = {
    fields,
    isValid,
    isDirty,
    isSubmitting,
    submitCount,
    errors,
  };

  return {
    state,
    values,
    setValue,
    setValues,
    setTouched,
    validateForm,
    validateField,
    handleSubmit,
    reset,
    getFieldProps,
    getFieldError,
    hasFieldError,
  };
}
