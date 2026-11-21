import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';
import { AuthLayout } from '../components/AuthLayout';
import { AlertIcon, CheckIcon } from '../components/icons';
import { Button, Input } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { signUpSchema, type SignUpValues } from '../lib/schemas';
import { getErrorMessage } from '../lib/utils';

export function SignupPage() {
  const { signUp } = useAuth();
  const toast = useToast();
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmationSent, setConfirmationSent] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<SignUpValues>({
    resolver: zodResolver(signUpSchema),
    defaultValues: {
      fullName: '',
      email: '',
      phone: '',
      password: '',
      confirmPassword: '',
    },
  });

  const onSubmit = async (values: SignUpValues) => {
    setFormError(null);
    try {
      const result = await signUp({
        email: values.email,
        password: values.password,
        fullName: values.fullName,
        phone: values.phone,
      });
      if (result.requiresEmailConfirmation) {
        setConfirmationSent(true);
        reset();
      } else {
        toast.success('Account created. Welcome to ClinicFlow!');
      }
    } catch (error) {
      const message = getErrorMessage(error, 'Could not create your account');
      setFormError(message);
      toast.error(message);
    }
  };

  if (confirmationSent) {
    return (
      <AuthLayout
        title="Check your inbox"
        subtitle="One more step to activate your ClinicFlow account."
        footer={
          <Link
            to="/login"
            className="font-semibold text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300"
          >
            Back to sign in
          </Link>
        }
      >
        <div className="flex flex-col items-center py-4 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
            <CheckIcon />
          </span>
          <p className="mt-4 text-sm text-slate-600 dark:text-slate-300">
            We sent a confirmation link to your email address. Open it to verify your account, then
            sign in. Don&apos;t forget to check spam.
          </p>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Create your account"
      subtitle="New accounts start with customer access. A clinic owner can promote you to staff later."
      footer={
        <span className="text-slate-600 dark:text-slate-400">
          Already registered?{' '}
          <Link
            to="/login"
            className="font-semibold text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300"
          >
            Sign in
          </Link>
        </span>
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
          label="Full name"
          autoComplete="name"
          placeholder="Dr. Jane Doe"
          error={errors.fullName?.message}
          {...register('fullName')}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Email address"
            type="email"
            autoComplete="email"
            placeholder="you@clinic.com"
            error={errors.email?.message}
            {...register('email')}
          />
          <Input
            label="Phone (optional)"
            type="tel"
            autoComplete="tel"
            placeholder="+1 555 010 2030"
            error={errors.phone?.message}
            {...register('phone')}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Password"
            type="password"
            autoComplete="new-password"
            placeholder="At least 8 characters"
            hint="Include a letter and a number."
            error={errors.password?.message}
            {...register('password')}
          />
          <Input
            label="Confirm password"
            type="password"
            autoComplete="new-password"
            placeholder="Repeat password"
            error={errors.confirmPassword?.message}
            {...register('confirmPassword')}
          />
        </div>

        <Button type="submit" fullWidth loading={isSubmitting}>
          Create account
        </Button>
        <p className="text-center text-xs text-slate-500 dark:text-slate-400">
          By creating an account you agree to keep patient information confidential.
        </p>
      </form>
    </AuthLayout>
  );
}
