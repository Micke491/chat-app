'use client';

import { useState } from 'react';
import { apiFetch } from '@/lib/api';
import { setAuthToken, setTrustedDeviceToken } from '@/lib/storage';

export function useLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [show2FAModal, setShow2FAModal] = useState(false);
  const [tempToken, setTempToken] = useState('');
  const [twoFaCode, setTwoFaCode] = useState('');
  const [rememberDevice, setRememberDevice] = useState(true);
  const [verifying2FA, setVerifying2FA] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await apiFetch(`/api/auth/login`, {
        method: 'POST',
        body: JSON.stringify({ email, password, rememberMe }),
      });

      const data = await response.json();
      if (!response.ok) {
        setError(data.message || 'Login failed');
        setEmail('');
        setPassword('');
        setLoading(false);
        return;
      }

      if (data.requires_2fa) {
        setTempToken(data.temp_token);
        setShow2FAModal(true);
        setLoading(false);
        return;
      }

      setAuthToken(data.token, rememberMe);
      window.location.href = '/chat'; 
    } catch (err) {
      setError('Something went wrong. Please try again.');
      setPassword('');
      setLoading(false);
    }
  };

  const handleVerify2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setVerifying2FA(true);

    try {
      const response = await apiFetch(`/api/auth/2fa/verify-login`, {
        method: 'POST',
        body: JSON.stringify({ temp_token: tempToken, code: twoFaCode, rememberDevice, rememberMe }),
      });

      const data = await response.json();
      if (!response.ok) {
        setError(data.error || data.message || 'Verification failed');
        setTwoFaCode('');
        setVerifying2FA(false);
        return;
      }

      if (data.trusted_device_token) {
        setTrustedDeviceToken(data.trusted_device_token);
      }
      setAuthToken(data.token, rememberMe);
      window.location.href = '/chat'; 
    } catch (err) {
      setError('Something went wrong. Please try again.');
      setVerifying2FA(false);
    }
  };

  return {
    email,
    setEmail,
    password,
    setPassword,
    rememberMe,
    setRememberMe,
    showPassword,
    setShowPassword,
    error,
    setError,
    loading,
    show2FAModal,
    setShow2FAModal,
    twoFaCode,
    setTwoFaCode,
    rememberDevice,
    setRememberDevice,
    verifying2FA,
    handleSubmit,
    handleVerify2FA,
  };
}
