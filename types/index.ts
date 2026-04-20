export interface Account {
  id: string
  user_id: string
  type: string
  bank: string
  number: string
  balance: number
  accent: string
  created_at: string
}

export interface Transaction {
  id: string
  user_id: string
  name: string
  category: string
  amount: number          // positive = income, negative = expense
  date: string
  type: 'income' | 'expense'
  source?: string
  created_at: string
}

export interface Bill {
  id: string
  user_id: string
  name: string
  plan: string
  amount: number
  due_day: number
  due_month: string
  last_charge: string
  created_at: string
}

export interface Goal {
  id: string
  user_id: string
  name: string
  target: number
  achieved: number
  deadline: string
  created_at: string
}

export interface Budget {
  id: string
  user_id: string
  category: string
  limit_amount: number
  spent: number
  created_at: string
}
