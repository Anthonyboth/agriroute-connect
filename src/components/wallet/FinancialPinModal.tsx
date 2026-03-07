import React, { useState, useRef, useEffect } from 'react';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Lock, ShieldCheck, ShieldAlert, AlertTriangle } from 'lucide-react';

interface FinancialPinModalProps {
  open: boolean;
  onClose: () => void;
  onVerify: (pin: string) => Promise<boolean>;
  onCreate?: (pin: string) => Promise<boolean>;
  mode: 'verify' | 'create';
  title?: string;
  description?: string;
}

export const FinancialPinModal: React.FC<FinancialPinModalProps> = ({
  open, onClose, onVerify, onCreate, mode, title, description
}) => {
  const [pin, setPin] = useState(['', '', '', '']);
  const [confirmPin, setConfirmPin] = useState(['', '', '', '']);
  const [step, setStep] = useState<'enter' | 'confirm'>('enter');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const confirmRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (open) {
      setPin(['', '', '', '']);
      setConfirmPin(['', '', '', '']);
      setStep('enter');
      setError('');
      setTimeout(() => inputRefs.current[0]?.focus(), 100);
    }
  }, [open]);

  const handleInput = (index: number, value: string, isConfirm = false) => {
    if (!/^\d*$/.test(value)) return;
    const digit = value.slice(-1);
    const arr = isConfirm ? [...confirmPin] : [...pin];
    arr[index] = digit;
    isConfirm ? setConfirmPin(arr) : setPin(arr);
    setError('');

    if (digit && index < 3) {
      const refs = isConfirm ? confirmRefs : inputRefs;
      refs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent, isConfirm = false) => {
    if (e.key === 'Backspace') {
      const arr = isConfirm ? [...confirmPin] : [...pin];
      if (!arr[index] && index > 0) {
        const refs = isConfirm ? confirmRefs : inputRefs;
        refs.current[index - 1]?.focus();
      }
    }
  };

  const pinValue = pin.join('');
  const confirmPinValue = confirmPin.join('');

  const handleSubmit = async () => {
    if (mode === 'create') {
      if (step === 'enter') {
        if (pinValue.length !== 4) { setError('Digite 4 dígitos'); return; }
        setStep('confirm');
        setTimeout(() => confirmRefs.current[0]?.focus(), 100);
        return;
      }
      if (confirmPinValue !== pinValue) {
        setError('PINs não coincidem');
        setConfirmPin(['', '', '', '']);
        setTimeout(() => confirmRefs.current[0]?.focus(), 100);
        return;
      }
      setLoading(true);
      const ok = await onCreate?.(pinValue);
      setLoading(false);
      if (ok) onClose();
      else setError('Erro ao criar PIN');
    } else {
      if (pinValue.length !== 4) { setError('Digite 4 dígitos'); return; }
      setLoading(true);
      const ok = await onVerify(pinValue);
      setLoading(false);
      if (!ok) {
        setError('PIN incorreto');
        setPin(['', '', '', '']);
        setTimeout(() => inputRefs.current[0]?.focus(), 100);
      }
    }
  };

  const renderPinInputs = (values: string[], refs: React.MutableRefObject<(HTMLInputElement | null)[]>, isConfirm = false) => (
    <div className="flex justify-center gap-3">
      {values.map((v, i) => (
        <Input
          key={i}
          ref={el => { refs.current[i] = el; }}
          type="password"
          inputMode="numeric"
          maxLength={1}
          value={v}
          onChange={e => handleInput(i, e.target.value, isConfirm)}
          onKeyDown={e => handleKeyDown(i, e, isConfirm)}
          className="w-12 h-14 text-center text-2xl font-bold tracking-widest"
        />
      ))}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {mode === 'create' ? (
              <><ShieldCheck className="h-5 w-5 text-primary" /> Criar PIN Financeiro</>
            ) : (
              <><Lock className="h-5 w-5 text-warning" /> {title || 'Confirmar Operação'}</>
            )}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {mode === 'create'
              ? 'Crie um PIN de 4 dígitos para proteger suas operações financeiras.'
              : description || 'Por segurança, digite seu PIN financeiro para continuar.'}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-4">
          {mode === 'create' && step === 'confirm' && (
            <p className="text-xs text-center text-muted-foreground font-medium">Confirme seu PIN</p>
          )}

          {step === 'enter' && renderPinInputs(pin, inputRefs)}
          {step === 'confirm' && renderPinInputs(confirmPin, confirmRefs, true)}

          {error && (
            <Alert variant="destructive" className="py-2">
              <AlertTriangle className="h-3.5 w-3.5" />
              <AlertDescription className="text-xs">{error}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={loading} className="gap-1.5">
            {loading ? 'Verificando...' : mode === 'create' ? (step === 'enter' ? 'Continuar' : 'Criar PIN') : 'Confirmar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
