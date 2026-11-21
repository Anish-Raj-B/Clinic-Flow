import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { AuthLayout } from '../components/AuthLayout';
import { AlertIcon } from '../components/icons';
import { Button, Input } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { newPasswordSchema, type NewPasswordValues } from '../lib/schemas';
import { getErrorMessage } from '../lib/utils';

export function ResetPasswordPage() {
  const { session, updatePassword } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<NewPasswordValues>({
    resolver: zodResolver(newPasswordSchema),
    defaultValues: { password: '', confirmPassword: '' },
  });

  const onSubmit = async (values: NewPasswordValues) => {
    setFormError(null);
    try {
      await updatePassword(values.password);
      toast.success('Password updated. You can now use your new password.');
      navigate('/app', { replace: true });
    } catch (error) {
      const message = getErrorMessage(error, 'Could not update your password');
      setFormError(message);
      toast.error(message);
    }
  };

  if (!session) {
    return (
      <AuthLayout
        title="Reset link needed"
        subtitle="Open the reset link from your email to continue."
        footer={
          <Link
            to="/login"
            className="font-semibold text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300"
          >
            Back to sign in
          </Link>
        }
      >
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
          This page must be opened from the password reset email. Request a new link if yours has
          expired.
        </div>
        <Button className="mt-4" fullWidth variant="outline" onClick={() => navigate('/forgot-password')}>
          Request a new link
        </Button>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Choose a new password"
      subtitle="Pick something you haven't used before."
      footer={
        <Link
          to="/app"
          className="font-semibold text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300"
        >
          Continue to ClinicFlow
        </Link>
      }
    >
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
          label="New password"
          type="password"
          autoComplete="new-password"
          placeholder="At least 8 characters"
          error={errors.password?.message}
          {...register('password')}
        />
        <Input
          label="Confirm new password"
          type="password"
          autoComplete="new-password"
          placeholder="Repeat password"
          error={errors.confirmPassword?.message}
          {...register('confirmPassword')}
        />
        <Button type="submit" fullWidth loading={isSubmitting}>
          Update password
        </Button>
      </form>
    </AuthLayout>
  );
}
