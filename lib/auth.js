// lib/auth.js
// ─────────────────────────────────────────────────────
// Authentication Service — Budget Book
// ─────────────────────────────────────────────────────
// Wraps Supabase Auth methods for signup, login,
// email OTP (MFA), session management, and signout.
// ─────────────────────────────────────────────────────

import { supabase } from './supabase'

// ── Sign Up (email + password) ──────────────────────
// After signup, Supabase sends a confirmation email.
// If you've configured the email template to use {{ .Token }},
// the user receives a 6-digit OTP instead of a magic link.
export async function signUp({ email, password, displayName }) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        display_name: displayName || email.split('@')[0],
      },
    },
  })

  if (error) throw error
  return data
}


// ── Sign In (email + password) ──────────────────────
export async function signIn({ email, password }) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) throw error
  return data
}


// ── Send OTP via Email (passwordless) ───────────────
// Use this for the MFA / email verification flow.
// IMPORTANT: In your Supabase Dashboard, go to:
//   Authentication → Email Templates → Magic Link
//   Replace {{ .ConfirmationURL }} with {{ .Token }}
// This makes Supabase send a 6-digit code instead of a link.
export async function sendOTP({ email }) {
  const { data, error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: false,  // Don't create new users via OTP
    },
  })

  if (error) throw error
  return data
}


// ── Verify OTP ──────────────────────────────────────
// Called after the user enters the 6-digit code from their email.
// On success, Supabase creates a session automatically.
export async function verifyOTP({ email, token }) {
  const { data, error } = await supabase.auth.verifyOtp({
    email,
    token,
    type: 'email',
  })

  if (error) throw error
  return data
}


// ── Resend OTP ──────────────────────────────────────
// Simply calls sendOTP again — Supabase handles rate limiting
// (default: once per 60 seconds).
export async function resendOTP({ email }) {
  return sendOTP({ email })
}


// ── Get Current Session ─────────────────────────────
export async function getSession() {
  const { data: { session }, error } = await supabase.auth.getSession()
  if (error) throw error
  return session
}


// ── Get Current User ────────────────────────────────
export async function getUser() {
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error) throw error
  return user
}


// ── Sign Out ────────────────────────────────────────
export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}


// ── Listen to Auth State Changes ────────────────────
// Use this to reactively update UI when user signs in/out.
// Returns an unsubscribe function.
//
// Example:
//   const unsub = onAuthStateChange((event, session) => {
//     if (event === 'SIGNED_IN') router.push('/dashboard')
//     if (event === 'SIGNED_OUT') router.push('/login')
//   })
//   // Later: unsub()
export function onAuthStateChange(callback) {
  const { data: { subscription } } = supabase.auth.onAuthStateChange(callback)
  return () => subscription.unsubscribe()
}
