import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';
import { AuthLayout } from '../components/AuthLayout';
import { AlertIcon, MailIcon } from '../components/icons';
import { Button, Input } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { forgotPasswordSchema, type ForgotPasswordValues } from '../lib/schemas';
import { getErrorMessage } from '../lib/utils';

export function ForgotPasswordPage() {
  const { resetPassword } = useAuth();
  const toast = useToast();
  const [formError, setFormError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  });

  const onSubmit = async (values: ForgotPasswordValues) => {
    setFormError(null);
    try {
      await resetPassword(values.email);
      setSent(true);
      toast.success('Password reset email sent');
    } catch (error) {
      const message = getErrorMessage(error, 'Could not send the reset email');
      setFormError(message);
      toast.error(message);
    }
  };

  return (
    <AuthLayout
      title="Reset your password"
      subtitle="We'll email you a secure link to choose a new password."
      footer={
        <Link
          to="/login"
          className="font-semibold text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300"
        >
          Back to sign in
        </Link>
      }
    >
      {sent ? (
        <div className="flex flex-col items-center py-2 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-100 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">
            <MailIcon />
          </span>
          <p className="mt-4 text-sm text-slate-600 dark:text-slate-300">
            If an account exists for <strong>{getValues('email')}</strong>, a reset link is on its
            way. The link expires after one hour.
          </p>
          <Button className="mt-5" variant="outline" onClick={() => setSent(false)}>
            Use a different email
          </Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          {formError ? (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200"
            >
              <AlertIcon className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{formError}</span>
            </div>
          ) : null}
          <Input
            label="Email address"
            type="email"
            autoComplete="email"
            placeholder="you@clinic.com"
            error={errors.email?.message}
            {...register('email')}
          />
          <Button type="submit" fullWidth loading={isSubmitting}>
            Send reset link
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
