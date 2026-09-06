import { useSignIn, useSignUp } from '@clerk/expo/legacy';
import { useSignInWithGoogle } from '@clerk/expo/google';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const LOGO_URL = 'https://res.cloudinary.com/dkqbzwicr/image/upload/v1788600768/logo_mmxfny.png';

type Stage = 'email' | 'code' | 'username';

export default function SignInScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const { startGoogleAuthenticationFlow } = useSignInWithGoogle();
  const signInHook = useSignIn();
  const signUpHook = useSignUp();

  const [stage, setStage] = useState<Stage>('email');
  const [flow, setFlow] = useState<'sign-in' | 'sign-up'>('sign-in');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [username, setUsername] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Set when a sign-up comes back needing a username. Each auth path (Google SSO
  // vs. email code) completes differently, so it stashes its own finisher here.
  const completeUsername = useRef<((value: string) => Promise<void>) | null>(null);

  const dismiss = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }, [router]);

  const onGoogle = useCallback(async () => {
    setError(null);
    setBusy(true);
    try {
      const { createdSessionId, setActive, signUp } = await startGoogleAuthenticationFlow();
      if (createdSessionId && setActive) {
        await setActive({ session: createdSessionId });
        dismiss();
        return;
      }
      if (signUp && setActive && signUp.status === 'missing_requirements') {
        if (signUp.missingFields.length && !signUp.missingFields.includes('username')) {
          setError(`Your account still needs: ${signUp.missingFields.join(', ')}.`);
          return;
        }
        completeUsername.current = async (value) => {
          const updated = await signUp.update({ username: value });
          if (updated.status === 'complete' && updated.createdSessionId) {
            await setActive({ session: updated.createdSessionId });
            dismiss();
          } else {
            throw new Error(
              updated.missingFields.length
                ? `Still needed: ${updated.missingFields.join(', ')}`
                : 'Could not finish setting up your account.',
            );
          }
        };
        setStage('username');
        return;
      }
      setError('Google sign-in was cancelled or did not complete.');
    } catch (err) {
      setError(readClerkError(err));
    } finally {
      setBusy(false);
    }
  }, [startGoogleAuthenticationFlow, dismiss]);

  const onSendCode = useCallback(async () => {
    if (!signInHook.isLoaded || !signUpHook.isLoaded) return;
    const { signIn } = signInHook;
    const { signUp } = signUpHook;
    const address = email.trim().toLowerCase();
    if (!address.includes('@')) {
      setError('Enter a valid email address.');
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const attempt = await signIn.create({ identifier: address });
      const factor = attempt.supportedFirstFactors?.find((f) => f.strategy === 'email_code');
      if (!factor || !('emailAddressId' in factor) || !factor.emailAddressId) {
        throw new Error('Email code sign-in is not enabled for this account.');
      }
      await signIn.prepareFirstFactor({ strategy: 'email_code', emailAddressId: factor.emailAddressId });
      setFlow('sign-in');
      setStage('code');
    } catch (err) {
      if (isUserNotFound(err)) {
        try {
          await signUp.create({ emailAddress: address });
          await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
          setFlow('sign-up');
          setStage('code');
          setError(null);
        } catch (err2) {
          setError(readClerkError(err2));
        }
      } else {
        setError(readClerkError(err));
      }
    } finally {
      setBusy(false);
    }
  }, [email, signInHook, signUpHook]);

  const onVerifyCode = useCallback(async () => {
    if (!signInHook.isLoaded || !signUpHook.isLoaded) return;
    setError(null);
    setBusy(true);
    try {
      if (flow === 'sign-in') {
        const res = await signInHook.signIn.attemptFirstFactor({
          strategy: 'email_code',
          code: code.trim(),
        });
        if (res.status === 'complete') {
          await signInHook.setActive({ session: res.createdSessionId });
          dismiss();
        } else {
          setError('Could not complete sign-in. Try again.');
        }
      } else {
        const res = await signUpHook.signUp.attemptEmailAddressVerification({ code: code.trim() });
        if (res.status === 'complete') {
          await signUpHook.setActive({ session: res.createdSessionId });
          dismiss();
        } else if (res.status === 'missing_requirements') {
          completeUsername.current = async (value) => {
            const updated = await res.update({ username: value });
            if (updated.status === 'complete' && updated.createdSessionId) {
              await signUpHook.setActive({ session: updated.createdSessionId });
              dismiss();
            } else {
              throw new Error(
                updated.missingFields.length
                  ? `Still needed: ${updated.missingFields.join(', ')}`
                  : 'Could not finish setting up your account.',
              );
            }
          };
          setStage('username');
        } else {
          setError('Could not complete sign-up. Try again.');
        }
      }
    } catch (err) {
      setError(readClerkError(err));
    } finally {
      setBusy(false);
    }
  }, [flow, code, signInHook, signUpHook, dismiss]);

  const onSubmitUsername = useCallback(async () => {
    const finish = completeUsername.current;
    if (!finish) {
      setError('Session expired. Please start again.');
      setStage('email');
      return;
    }
    const value = username.trim();
    if (value.length < 3) {
      setError('Username must be at least 3 characters.');
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await finish(value);
    } catch (err) {
      setError(readClerkError(err));
    } finally {
      setBusy(false);
    }
  }, [username]);

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.body, { paddingTop: insets.top + 12 }]}>
        <Pressable
          accessibilityLabel="Close"
          onPress={dismiss}
          style={({ pressed }) => [styles.close, pressed && styles.pressed]}
        >
          <Ionicons name="close" size={22} color="#3c2924" />
        </Pressable>

        <Image source={{ uri: LOGO_URL }} style={styles.logo} contentFit="cover" />
        <Text style={styles.title}>
          {stage === 'username' ? 'Choose a username' : 'Sign in to AstraVeda'}
        </Text>
        <Text style={styles.subtitle}>
          {stage === 'username'
            ? 'This is how you’ll appear in AstraVeda.'
            : 'Save your birth details, credits, wallet and reading history.'}
        </Text>

        {stage === 'email' && (
          <>
            <Pressable
              disabled={busy}
              onPress={onGoogle}
              style={({ pressed }) => [styles.googleBtn, pressed && styles.pressed, busy && styles.disabled]}
            >
              <Ionicons name="logo-google" size={18} color="#3c2924" />
              <Text style={styles.googleText}>Continue with Google</Text>
            </Pressable>

            <View style={styles.divider}>
              <View style={styles.line} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.line} />
            </View>

            <TextInput
              style={styles.input}
              placeholder="you@email.com"
              placeholderTextColor="#b6a094"
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
              editable={!busy}
            />
            <Pressable
              disabled={busy}
              onPress={onSendCode}
              style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed, busy && styles.disabled]}
            >
              {busy ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.primaryText}>Email me a code</Text>
              )}
            </Pressable>
          </>
        )}

        {stage === 'code' && (
          <>
            <Text style={styles.codeHint}>Enter the 6-digit code sent to {email.trim().toLowerCase()}</Text>
            <TextInput
              style={[styles.input, styles.codeInput]}
              placeholder="123456"
              placeholderTextColor="#b6a094"
              keyboardType="number-pad"
              maxLength={6}
              value={code}
              onChangeText={setCode}
              editable={!busy}
            />
            <Pressable
              disabled={busy}
              onPress={onVerifyCode}
              style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed, busy && styles.disabled]}
            >
              {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Verify & continue</Text>}
            </Pressable>
            <Pressable
              onPress={() => {
                setStage('email');
                setCode('');
                setError(null);
              }}
              style={styles.linkBtn}
            >
              <Text style={styles.linkText}>Use a different email</Text>
            </Pressable>
          </>
        )}

        {stage === 'username' && (
          <>
            <TextInput
              style={styles.input}
              placeholder="your_username"
              placeholderTextColor="#b6a094"
              autoCapitalize="none"
              autoCorrect={false}
              value={username}
              onChangeText={setUsername}
              editable={!busy}
            />
            <Pressable
              disabled={busy}
              onPress={onSubmitUsername}
              style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed, busy && styles.disabled]}
            >
              {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Continue</Text>}
            </Pressable>
          </>
        )}

        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>
    </KeyboardAvoidingView>
  );
}

function readClerkError(err: unknown): string {
  const anyErr = err as {
    errors?: { longMessage?: string; message?: string }[];
    longMessage?: string;
    message?: string;
  };
  return (
    anyErr?.errors?.[0]?.longMessage ??
    anyErr?.errors?.[0]?.message ??
    anyErr?.longMessage ??
    anyErr?.message ??
    'Something went wrong. Please try again.'
  );
}

function isUserNotFound(err: unknown): boolean {
  const anyErr = err as { errors?: { code?: string }[] };
  return anyErr?.errors?.some((e) => e.code === 'form_identifier_not_found') ?? false;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fffaf2' },
  body: { flex: 1, paddingHorizontal: 28, alignItems: 'center' },
  close: { alignSelf: 'flex-end', padding: 8, marginBottom: 4 },
  logo: { width: 56, height: 56, borderRadius: 16, marginTop: 8, marginBottom: 18 },
  title: { fontSize: 22, fontWeight: '700', color: '#4a2f20', marginBottom: 8 },
  subtitle: {
    fontSize: 13,
    lineHeight: 20,
    color: '#896f62',
    textAlign: 'center',
    marginBottom: 28,
  },
  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    width: '100%',
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e6d5c6',
    backgroundColor: '#fff',
  },
  googleText: { fontSize: 15, fontWeight: '600', color: '#3c2924' },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 12, width: '100%', marginVertical: 18 },
  line: { flex: 1, height: 1, backgroundColor: '#e6d5c6' },
  dividerText: { fontSize: 12, color: '#a78d7e' },
  input: {
    width: '100%',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e6d5c6',
    backgroundColor: '#fff',
    fontSize: 15,
    color: '#3c2924',
    marginBottom: 12,
  },
  codeInput: { textAlign: 'center', letterSpacing: 6, fontSize: 20 },
  codeHint: { fontSize: 13, color: '#896f62', textAlign: 'center', marginBottom: 16 },
  primaryBtn: {
    width: '100%',
    paddingVertical: 15,
    borderRadius: 16,
    backgroundColor: '#8f29dd',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: { fontSize: 15, fontWeight: '700', color: '#fff' },
  linkBtn: { marginTop: 16, padding: 6 },
  linkText: { fontSize: 13, color: '#8f29dd', fontWeight: '600' },
  error: { marginTop: 16, fontSize: 13, color: '#c0392b', textAlign: 'center' },
  pressed: { opacity: 0.7 },
  disabled: { opacity: 0.5 },
});
