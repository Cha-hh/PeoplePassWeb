import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL     = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export type MembershipType = 'full_pass' | '3_pass' | '2_pass' | 'visit_pass' | 'trial_pass' | 'wellhub' | 'fitness_pass';
export type PaymentMethod  = 'cash' | 'card';

export interface User {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  membershipType: MembershipType;
  membershipStatus: 'active' | 'expired' | 'suspended';
  renewalDate: string;
  startDate: string;
  qrCode: string;
}

export interface AccessLog {
  id: string;
  userId?: string;
  userName?: string;
  membershipType: MembershipType;
  accessTime: string;
  status: 'granted' | 'denied';
  deniedReason?: string;
}

export interface Payment {
  id: string;
  userId: string;
  userName: string;
  membershipType: MembershipType;
  amount: number;
  paymentMethod: PaymentMethod;
  renewalDate: string;
  paidAt: string;
  notes?: string;
}

export const MEMBERSHIP_LABELS: Record<MembershipType, string> = {
  full_pass:    'Ilimitado',
  '3_pass':     '12 Clases',
  '2_pass':     '8 Clases',
  visit_pass:   'Visita',
  trial_pass:   'Prueba',
  wellhub:      'Wellhub',
  fitness_pass: 'Fitness Pass',
};
