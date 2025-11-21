import { useEffect, useState, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useWallet } from '../context/WalletContext'
import { useDevice } from '../context/DeviceContext'

type StatusState = { type: 'success' | 'error'; message: string } | null

const TRANSACTION_FEE = 100 // Fixed transaction fee in PHP
const SELLER_HOLD_AMOUNT = 100 // Amount to hold from seller in PHP
const MIN_TRANSACTION_AMOUNT = 5000 // Minimum transaction amount in PHP

interface TransactionInvite {
  buyerId: string
  amount: number
  createdAt: number
  description?: string
  sellerPhoneNumber: string
  buyerPhoneNumber?: string
  sellerConnected?: boolean
  sellerApproved?: boolean
  sellerAmountOnHold?: boolean
  holdReleased?: boolean
  amountHeldInEscrow?: boolean
  buyerConfirmed?: boolean
  sellerConfirmed?: boolean
  completed?: boolean
  completedAt?: number
  protectionWindowExpiryDate?: number
  // Legacy fields for backward compatibility
  protectionWindowDays?: number
  protectionWindowHours?: number
  expired?: boolean
  expiredAt?: number
  extensionRequested?: boolean
  extensionRequestDays?: number
  extensionRequestHours?: number
  extensionApproved?: boolean
  extensionApprovedDays?: number
  extensionApprovedHours?: number
  extensionApprovedAt?: number
}

export default function Escrow() {
  const navigate = useNavigate()
  const { balance, subtractBalance, addBalance, deviceType } = useWallet()
  const { setDeviceType, phoneNumber, setPhoneNumber } = useDevice()
  const [status, setStatus] = useState<StatusState>(null)
  
  // Mock phone numbers for both users
  const mockBuyerPhoneNumber = '+63 912 345 6789'
  const mockSellerPhoneNumber = '+63 987 654 3210'
  
  const [transactionAmount, setTransactionAmount] = useState('5000')
  const [transactionDescription, setTransactionDescription] = useState('')
  const [sellerPhoneNumber, setSellerPhoneNumber] = useState(mockSellerPhoneNumber)
  // Set default to tomorrow
  const [protectionWindowDate, setProtectionWindowDate] = useState(() => {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    return tomorrow.toISOString().split('T')[0]
  })
  const [inviteLink, setInviteLink] = useState<string | null>(null)
  const [invitePayload, setInvitePayload] = useState<TransactionInvite | null>(null)
  const [connected, setConnected] = useState(false)
  const [activeTransaction, setActiveTransaction] = useState<TransactionInvite | null>(null)
  const [buyerConfirmed, setBuyerConfirmed] = useState(false)
  const [sellerConfirmed, setSellerConfirmed] = useState(false)
  const [amountHeldInEscrow, setAmountHeldInEscrow] = useState(false)
  const [transferCompleted, setTransferCompleted] = useState(false)
  const [sellerConnected, setSellerConnected] = useState(false)
  const [sellerAmountOnHold, setSellerAmountOnHold] = useState(false)
  const [countdownUpdate, setCountdownUpdate] = useState(0)
  const [pendingTransactions, setPendingTransactions] = useState<TransactionInvite[]>([])
  const [termsAccepted, setTermsAccepted] = useState<Record<string, boolean>>({})
  const [buyerTermsAccepted, setBuyerTermsAccepted] = useState(false)
  
  // Extension request states
  const [extensionRequestDate, setExtensionRequestDate] = useState(() => {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    return tomorrow.toISOString().split('T')[0]
  })
  const [showExtensionModal, setShowExtensionModal] = useState(false)
  const [showAddFundsModal, setShowAddFundsModal] = useState(false)
  const [addFundsBuyerAmount, setAddFundsBuyerAmount] = useState('')
  const [addFundsSellerAmount, setAddFundsSellerAmount] = useState('')
  
  // Seller wallet balance - read directly from localStorage
  const [sellerWalletBalance, setSellerWalletBalance] = useState<number>(() => {
    const stored = localStorage.getItem('wallet_balance_seller')
    return stored ? parseFloat(stored) : 5000.00
  })
  
  // Buyer wallet balance - read directly from localStorage
  const [buyerWalletBalance, setBuyerWalletBalance] = useState<number>(() => {
    const stored = localStorage.getItem('wallet_balance_buyer')
    return stored ? parseFloat(stored) : 10000.00
  })
  
  // Force render trigger for seller balance updates
  const [, forceUpdate] = useState(0)
  
  // Memoized formatted seller balance to ensure re-render on change
  const formattedSellerBalance = useMemo(() => {
    console.log('🔢 Formatting seller balance:', sellerWalletBalance)
    return sellerWalletBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })
  }, [sellerWalletBalance])
  
  // Determine if current user is buyer (has inviteLink) or seller (connected via invite)
  const isBuyer = !!inviteLink
  const isSeller = connected && !inviteLink
  
  // Get current user's mock phone number based on role
  const getCurrentUserPhoneNumber = () => {
    if (isSeller) {
      return mockSellerPhoneNumber
    }
    return mockBuyerPhoneNumber
  }
  
  const currentUserPhoneNumber = getCurrentUserPhoneNumber()

  function handleStatus(next: StatusState) {
    setStatus(next)
    if (next) {
      window.setTimeout(() => setStatus(null), 4000)
    }
  }

  // Load pending transactions for seller
  function loadPendingTransactions() {
    const allKeys = Object.keys(localStorage)
    const transactionKeys = allKeys.filter(key => key.startsWith('txn_'))
    const pending: TransactionInvite[] = []
    
    for (const key of transactionKeys) {
      try {
        const storedData = localStorage.getItem(key)
        if (storedData) {
          const payload: TransactionInvite = JSON.parse(storedData)
          
          // Check if transaction is pending for this seller
          const isForThisSeller = payload.sellerPhoneNumber && 
            payload.sellerPhoneNumber.trim() === mockSellerPhoneNumber.trim()
          const isNotConnected = !payload.sellerConnected
          const isNotApproved = payload.sellerApproved === undefined || payload.sellerApproved === false
          const isNotCompleted = !payload.completed
          const isNotExpired = !payload.expired
          
          if (isForThisSeller && isNotConnected && isNotApproved && isNotCompleted && isNotExpired) {
            pending.push(payload)
          }
        }
      } catch (error) {
        // Skip invalid entries
      }
    }
    
    // Sort by creation date (newest first)
    pending.sort((a, b) => b.createdAt - a.createdAt)
    setPendingTransactions(pending)
  }

  // Restore ongoing transaction on page load
  useEffect(() => {
    // First check for ongoing transactions in localStorage
    const allKeys = Object.keys(localStorage)
    const transactionKeys = allKeys.filter(key => key.startsWith('txn_'))
    
    for (const key of transactionKeys) {
      try {
        const storedData = localStorage.getItem(key)
        if (storedData) {
          const payload: TransactionInvite = JSON.parse(storedData)
          
          // Only restore if transaction is ongoing (not completed and not expired)
          if (!payload.completed && !payload.expired) {
            const transactionId = payload.buyerId
            
            // Determine if current user is buyer or seller based on phone number
            // Use trim() for comparison to handle any whitespace differences
            const isCurrentUserBuyer = payload.buyerPhoneNumber && payload.buyerPhoneNumber.trim() === mockBuyerPhoneNumber.trim()
            const isCurrentUserSeller = payload.sellerPhoneNumber && payload.sellerPhoneNumber.trim() === mockSellerPhoneNumber.trim()
            
            // Restore seller if phone number matches (regardless of sellerConnected status)
            // This ensures seller can restore their state even if they refresh before connecting
            if (isCurrentUserSeller) {
              // Restore seller state
              setInvitePayload(payload)
              setActiveTransaction(payload)
              setConnected(true)
              setDeviceType('seller')
              
              // Restore seller states
              if (payload.sellerConnected) {
                setSellerConnected(true)
              }
              if (payload.amountHeldInEscrow) {
                setAmountHeldInEscrow(true)
              }
              if (payload.buyerConfirmed) {
                setBuyerConfirmed(true)
              }
              if (payload.sellerConfirmed) {
                setSellerConfirmed(true)
              }
              if (payload.sellerAmountOnHold) {
                setSellerAmountOnHold(true)
              }
              if (payload.completed) {
                setTransferCompleted(true)
              }
              
              // Update seller wallet balance from localStorage
              const sellerWalletKey = 'wallet_balance_seller'
              const currentSellerBalance = localStorage.getItem(sellerWalletKey)
              if (currentSellerBalance) {
                const balance = parseFloat(currentSellerBalance)
                setSellerWalletBalance(balance)
              }
              
              // Only restore one transaction (the most recent one)
              break
            } else if (isCurrentUserBuyer) {
              // Restore buyer state
              setInviteLink(transactionId)
              setInvitePayload(payload)
              setActiveTransaction(payload)
              setDeviceType('buyer')
              
              // Restore buyer states
              if (payload.sellerConnected) {
                setSellerConnected(true)
              }
              if (payload.amountHeldInEscrow) {
                setAmountHeldInEscrow(true)
              }
              if (payload.buyerConfirmed) {
                setBuyerConfirmed(true)
              }
              if (payload.sellerConfirmed) {
                setSellerConfirmed(true)
              }
              if (payload.completed) {
                setTransferCompleted(true)
              }
              
              // Only restore one transaction (the most recent one)
              break
            }
          }
        }
      } catch (error) {
        // Skip invalid transaction data
        continue
      }
    }
  }, [])

  // Load pending transactions for seller and listen for new transactions
  useEffect(() => {
    // Load pending transactions on mount and when seller view is active
    if (!connected || isSeller) {
      loadPendingTransactions()
    }

    // Listen for new transaction created events
    const handleTransactionCreated = () => {
      loadPendingTransactions()
    }

    window.addEventListener('transactionCreated', handleTransactionCreated)
    
    // Also poll for new transactions periodically (every 2 seconds)
    const interval = setInterval(() => {
      if (!connected || isSeller) {
        loadPendingTransactions()
      }
    }, 2000)

    return () => {
      window.removeEventListener('transactionCreated', handleTransactionCreated)
      clearInterval(interval)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected, isSeller])

  // Handle transaction ID from URL parameter
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const transactionIdParam = params.get('id') || params.get('invite')
    if (transactionIdParam) {
      try {
        // Try to get from localStorage first
        const storedData = localStorage.getItem(`txn_${transactionIdParam}`)
        if (storedData) {
          const payload: TransactionInvite = JSON.parse(storedData)
          
          // Verify phone number - when connecting via URL, it's a seller, so use mock seller phone number
          if (payload.sellerPhoneNumber && payload.sellerPhoneNumber.trim() !== mockSellerPhoneNumber.trim()) {
            handleStatus({ type: 'error', message: 'Access denied. Your phone number does not match the transaction.' })
            window.history.replaceState({}, document.title, window.location.pathname)
            return
          }
          
          // Mark seller as connected in the payload
          payload.sellerConnected = true
          
          // Save updated payload back to localStorage
          const transactionKey = `txn_${payload.buyerId}`
          localStorage.setItem(transactionKey, JSON.stringify(payload))
          
          // Ensure device type is set to seller
          if (deviceType !== 'seller') {
            setDeviceType('seller')
          }
          
          // Check if amount is already on hold (from approval)
          if (payload.sellerAmountOnHold) {
            setSellerAmountOnHold(true)
          }
          
          // Note: The ₱100 security deposit will be deducted when seller clicks "Approve" button
          // No deduction happens here during URL connection
          
          setInvitePayload(payload)
          setActiveTransaction(payload)
          setConnected(true)
          handleStatus({ type: 'success', message: 'Transaction ID received! Please approve the transaction from your pending list.' })
          // Clean URL
          window.history.replaceState({}, document.title, window.location.pathname)
        } else {
          // Fallback: try to decode as base64
          try {
            const decoded = window.atob(decodeURIComponent(transactionIdParam))
            const payload: TransactionInvite = JSON.parse(decoded)
            
            // Verify phone number - when connecting via URL, it's a seller, so use mock seller phone number
            if (payload.sellerPhoneNumber && payload.sellerPhoneNumber.trim() !== mockSellerPhoneNumber.trim()) {
              handleStatus({ type: 'error', message: 'Access denied. Your phone number does not match the transaction.' })
              window.history.replaceState({}, document.title, window.location.pathname)
              return
            }
            
            // Mark seller as connected in the payload
            payload.sellerConnected = true
            
            // Save updated payload back to localStorage
            const transactionKey = `txn_${payload.buyerId}`
            localStorage.setItem(transactionKey, JSON.stringify(payload))
            
            // Ensure device type is set to seller
            if (deviceType !== 'seller') {
              setDeviceType('seller')
            }
            
            // Check if amount is already on hold (from approval)
            if (payload.sellerAmountOnHold) {
              setSellerAmountOnHold(true)
            }
            
            // Note: The ₱100 security deposit will be deducted when seller clicks "Approve" button
            // No deduction happens here during URL connection
            
            setInvitePayload(payload)
            setActiveTransaction(payload)
            setConnected(true)
            handleStatus({ type: 'success', message: 'Transaction ID received! Please approve the transaction from your pending list.' })
            window.history.replaceState({}, document.title, window.location.pathname)
          } catch {
            handleStatus({ type: 'error', message: 'Invalid transaction ID.' })
          }
        }
      } catch (error) {
        handleStatus({ type: 'error', message: 'Invalid transaction ID.' })
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const transactionIdQrSrc = inviteLink
    ? `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(inviteLink)}`
    : null

  function handleCreateTransaction() {
    const amount = Number(transactionAmount)
    if (Number.isNaN(amount) || amount <= 0) {
      handleStatus({ type: 'error', message: 'Enter a valid transaction amount.' })
      return
    }

    if (amount < MIN_TRANSACTION_AMOUNT) {
      handleStatus({ type: 'error', message: `Transaction amount must be at least ₱${MIN_TRANSACTION_AMOUNT.toLocaleString(undefined, { minimumFractionDigits: 2 })}.` })
      return
    }

    if (amount > balance) {
      handleStatus({ type: 'error', message: 'Insufficient balance.' })
      return
    }

    if (!sellerPhoneNumber.trim()) {
      handleStatus({ type: 'error', message: 'Enter the seller\'s phone number.' })
      return
    }

    // Validate phone number format (basic validation)
    const phoneRegex = /^[0-9+\-\s()]+$/
    if (!phoneRegex.test(sellerPhoneNumber.trim())) {
      handleStatus({ type: 'error', message: 'Please enter a valid phone number.' })
      return
    }

    // Generate a transaction ID
    const transactionId = `TXN-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`

    // Validate protection window date
    if (!protectionWindowDate) {
      handleStatus({ type: 'error', message: 'Please select a protection window expiry date.' })
      return
    }
    
    const selectedDate = new Date(protectionWindowDate)
    const now = new Date()
    
    if (selectedDate <= now) {
      handleStatus({ type: 'error', message: 'Protection window expiry date must be in the future.' })
      return
    }

    // Validate transaction description
    if (!transactionDescription.trim()) {
      handleStatus({ type: 'error', message: 'Please enter a transaction description.' })
      return
    }

    // Use the input seller phone number and mock buyer phone number
    const payload: TransactionInvite = {
      buyerId: transactionId,
      amount,
      createdAt: Date.now(),
      description: transactionDescription.trim(),
      sellerPhoneNumber: sellerPhoneNumber.trim(),
      buyerPhoneNumber: mockBuyerPhoneNumber,
      protectionWindowExpiryDate: selectedDate.getTime(),
    }
    
    // Store transaction data in localStorage using transaction ID as key
    localStorage.setItem(`txn_${transactionId}`, JSON.stringify(payload))
    
    // Automatically connect transaction to seller's account (pending approval)
    // The transaction is now available in seller's pending transactions list
    // Dispatch event to notify seller view to refresh pending transactions
    window.dispatchEvent(new CustomEvent('transactionCreated', {
      detail: { transactionId, sellerPhoneNumber: sellerPhoneNumber.trim() }
    }))
    
    // Don't deduct amount yet - buyer will send money to escrow after seller connects
    // subtractBalance(amount)
    
    // Ensure device type is set to buyer
    if (deviceType !== 'buyer') {
      setDeviceType('buyer')
    }
    
    setInvitePayload(payload)
    setActiveTransaction(payload)
    setInviteLink(transactionId) // Store transaction ID instead of link
    handleStatus({ type: 'success', message: 'Transaction created and sent to seller. Waiting for seller approval.' })
  }

  async function copyTransactionId() {
    if (!inviteLink) return
    try {
      await navigator.clipboard.writeText(inviteLink)
      handleStatus({ type: 'success', message: 'Transaction ID copied to clipboard.' })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to copy transaction ID.'
      handleStatus({ type: 'error', message })
    }
  }

  // Check if seller has connected (from buyer's perspective)
  useEffect(() => {
    if (isBuyer && activeTransaction) {
      const checkSellerConnection = () => {
        const transactionKey = `txn_${activeTransaction.buyerId}`
        const storedData = localStorage.getItem(transactionKey)
        if (storedData) {
          const payload = JSON.parse(storedData)
          if (payload.sellerConnected && !sellerConnected) {
            setSellerConnected(true)
            handleStatus({ type: 'success', message: 'Seller has connected! You can now send money to escrow wallet.' })
          }
          // Load confirmation states from localStorage
          if (payload.buyerConfirmed && !buyerConfirmed) {
            setBuyerConfirmed(true)
          }
          if (payload.sellerConfirmed && !sellerConfirmed) {
            setSellerConfirmed(true)
          }
          // Sync extension request/approval status
          if (payload.extensionRequested !== activeTransaction.extensionRequested ||
              payload.extensionApproved !== activeTransaction.extensionApproved ||
              payload.extensionRequestDays !== activeTransaction.extensionRequestDays ||
              payload.extensionRequestHours !== activeTransaction.extensionRequestHours) {
            setActiveTransaction(payload)
          }
          // If both confirmed, trigger transfer
          if (payload.buyerConfirmed && payload.sellerConfirmed && amountHeldInEscrow && !transferCompleted) {
            handleTransferToSeller()
          }
        }
      }
      
      checkSellerConnection()
      // Poll for seller connection and confirmations
      const interval = setInterval(checkSellerConnection, 1000)
      return () => clearInterval(interval)
    }
  }, [isBuyer, activeTransaction, sellerConnected, buyerConfirmed, sellerConfirmed, amountHeldInEscrow, transferCompleted])


  function handleSendMoneyToEscrow() {
    if (!activeTransaction) return
    
    const amount = activeTransaction.amount
    const totalAmount = amount + TRANSACTION_FEE
    
    if (totalAmount > balance) {
      handleStatus({ type: 'error', message: `Insufficient balance. You need ₱${totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })} (amount + transaction fee).` })
      return
    }

    // Deduct amount and transaction fee from wallet
    subtractBalance(amount)
    subtractBalance(TRANSACTION_FEE)
    
    // Mark amount as held in escrow
    setAmountHeldInEscrow(true)
    
    // Update localStorage to mark money as sent
    const transactionKey = `txn_${activeTransaction.buyerId}`
    const storedData = localStorage.getItem(transactionKey)
    if (storedData) {
      const payload = JSON.parse(storedData)
      payload.amountHeldInEscrow = true
      localStorage.setItem(transactionKey, JSON.stringify(payload))
    }
    
    handleStatus({ type: 'success', message: `₱${amount.toLocaleString(undefined, { minimumFractionDigits: 2 })} sent to escrow wallet! Transaction fee of ₱${TRANSACTION_FEE.toLocaleString(undefined, { minimumFractionDigits: 2 })} deducted.` })
  }

  // Approve a pending transaction
  function handleSellerApprove(transaction: TransactionInvite) {
    try {
      const transactionId = transaction.buyerId
      const transactionKey = `txn_${transactionId}`
      const storedData = localStorage.getItem(transactionKey)
      
      if (!storedData) {
        handleStatus({ type: 'error', message: 'Transaction not found.' })
        loadPendingTransactions()
        return
      }

      const payload: TransactionInvite = JSON.parse(storedData)
      
      // Verify phone number matches
      if (payload.sellerPhoneNumber && payload.sellerPhoneNumber.trim() !== mockSellerPhoneNumber.trim()) {
        handleStatus({ type: 'error', message: 'Access denied. Your phone number does not match the transaction.' })
        loadPendingTransactions()
        return
      }
      
      // Mark seller as approved and connected
      payload.sellerApproved = true
      payload.sellerConnected = true
      
      // Deduct ₱100 security deposit from seller's wallet (will be returned when transaction completes)
      const sellerWalletKey = 'wallet_balance_seller'
      const currentSellerBalance = localStorage.getItem(sellerWalletKey)
      const sellerBalance = currentSellerBalance ? parseFloat(currentSellerBalance) : 5000.00
      
      if (sellerBalance >= SELLER_HOLD_AMOUNT) {
        const newSellerBalance = sellerBalance - SELLER_HOLD_AMOUNT
        localStorage.setItem(sellerWalletKey, newSellerBalance.toString())
        setSellerWalletBalance(newSellerBalance)
        
        // Mark that seller amount is on hold
        payload.sellerAmountOnHold = true
        
        // Dispatch custom event to notify other components
        window.dispatchEvent(new CustomEvent('localStorageChange', {
          detail: { key: sellerWalletKey, newValue: newSellerBalance.toString() }
        }))
      } else {
        handleStatus({ type: 'error', message: `Insufficient balance. You need at least ₱${SELLER_HOLD_AMOUNT.toLocaleString(undefined, { minimumFractionDigits: 2 })} security deposit.` })
        loadPendingTransactions()
        return
      }
      
      // Save updated payload
      localStorage.setItem(transactionKey, JSON.stringify(payload))
      
      // Connect to transaction (similar to handleSellerConnect logic)
      connectSellerToTransaction(payload)
      
      // Remove from pending list
      loadPendingTransactions()
      
      handleStatus({ type: 'success', message: `Transaction approved! ₱${SELLER_HOLD_AMOUNT.toLocaleString(undefined, { minimumFractionDigits: 2 })} security deposit held. Buyer can now send money to escrow.` })
    } catch (error) {
      handleStatus({ type: 'error', message: 'Failed to approve transaction.' })
      loadPendingTransactions()
    }
  }

  // Reject a pending transaction
  function handleSellerReject(transaction: TransactionInvite) {
    try {
      const transactionId = transaction.buyerId
      const transactionKey = `txn_${transactionId}`
      const storedData = localStorage.getItem(transactionKey)
      
      if (storedData) {
        const payload: TransactionInvite = JSON.parse(storedData)
        
        // Mark as rejected (sellerApproved = false explicitly)
        payload.sellerApproved = false
        
        // Save updated payload
        localStorage.setItem(transactionKey, JSON.stringify(payload))
      }
      
      // Remove from pending list
      loadPendingTransactions()
      
      handleStatus({ type: 'success', message: 'Transaction rejected.' })
    } catch (error) {
      handleStatus({ type: 'error', message: 'Failed to reject transaction.' })
      loadPendingTransactions()
    }
  }

  // Helper function to connect seller to transaction (extracted from handleSellerConnect)
  function connectSellerToTransaction(payload: TransactionInvite) {
    // Ensure device type is set to seller
    if (deviceType !== 'seller') {
      setDeviceType('seller')
    }
    
    setInvitePayload(payload)
    setActiveTransaction(payload)
    setConnected(true)
    
    // Check if seller amount is already on hold (from approval)
    if (payload.sellerAmountOnHold) {
      setSellerAmountOnHold(true)
    }
    
    // Note: The ₱100 security deposit is deducted when seller clicks "Approve" button
    // in handleSellerApprove function, not here
  }

  // Check if amount is held in escrow (from seller's perspective)
  useEffect(() => {
    if (connected && activeTransaction && isSeller) {
      const checkEscrowStatus = () => {
        const transactionKey = `txn_${activeTransaction.buyerId}`
        const storedData = localStorage.getItem(transactionKey)
        if (storedData) {
          const payload = JSON.parse(storedData)
          if (payload.amountHeldInEscrow && !amountHeldInEscrow) {
            setAmountHeldInEscrow(true)
            handleStatus({ type: 'success', message: 'Amount held in escrow wallet!' })
          }
          // Check for buyer confirmation
          if (payload.buyerConfirmed && !buyerConfirmed) {
            setBuyerConfirmed(true)
          }
          // Check for seller confirmation
          if (payload.sellerConfirmed && !sellerConfirmed) {
            setSellerConfirmed(true)
          }
          // Check for seller amount on hold
          if (payload.sellerAmountOnHold && !sellerAmountOnHold) {
            setSellerAmountOnHold(true)
          }
          // Sync extension request/approval status
          if (payload.extensionRequested !== activeTransaction.extensionRequested ||
              payload.extensionApproved !== activeTransaction.extensionApproved ||
              payload.extensionApprovedDays !== activeTransaction.extensionApprovedDays ||
              payload.extensionApprovedHours !== activeTransaction.extensionApprovedHours) {
            setActiveTransaction(payload)
          }
          // Check for completed transaction and update balance
          if (payload.completed) {
            const sellerWalletKey = 'wallet_balance_seller'
            const currentSellerBalance = localStorage.getItem(sellerWalletKey)
            if (currentSellerBalance) {
              const balance = parseFloat(currentSellerBalance)
              // Always update balance from localStorage when transaction is completed
              // This ensures the UI reflects the correct balance
              // Force update regardless of ref to ensure state syncs with localStorage
              lastBalanceRef.current = balance
              setSellerWalletBalance(balance)
              // Dispatch custom event to notify listeners
              window.dispatchEvent(new CustomEvent('localStorageChange', {
                detail: { key: sellerWalletKey, newValue: balance.toString() }
              }))
            }
            if (!transferCompleted) {
              setTransferCompleted(true)
            }
          }
        }
      }
      
      checkEscrowStatus()
      // Poll for escrow status and confirmations
      const interval = setInterval(checkEscrowStatus, 1000)
      return () => clearInterval(interval)
    }
  }, [connected, activeTransaction, isSeller, amountHeldInEscrow, buyerConfirmed, sellerConfirmed, sellerAmountOnHold, transferCompleted])


  // When buyer creates transaction and seller connects, hold amount in escrow
  // Also check for completed transactions to update seller's wallet and state
  useEffect(() => {
    if (connected && activeTransaction && isSeller) {
      // Ensure device type is set to seller
      if (deviceType !== 'seller') {
        setDeviceType('seller')
      }
      
      const checkCompletedTransaction = () => {
        // Check if transaction was already completed
        const transactionKey = `txn_${activeTransaction.buyerId}`
        const storedData = localStorage.getItem(transactionKey)
        if (storedData) {
          const payload = JSON.parse(storedData)
          if (payload.completed && !transferCompleted) {
            // Check if seller has already been credited for this transaction
            const creditedKey = `credited_${activeTransaction.buyerId}`
            const alreadyCredited = localStorage.getItem(creditedKey)
            
            if (!alreadyCredited) {
              // The wallet should already be updated in localStorage by handleTransferToSeller
              // Just update the state here
              const sellerWalletKey = 'wallet_balance_seller'
              const currentSellerBalance = localStorage.getItem(sellerWalletKey)
              const sellerBalance = currentSellerBalance ? parseFloat(currentSellerBalance) : 5000.00
              
              // Ensure device type is set to seller
              if (deviceType !== 'seller') {
                setDeviceType('seller')
              }
              
              // Update sellerWalletBalance state using functional update
              lastBalanceRef.current = sellerBalance
              setSellerWalletBalance(() => sellerBalance)
              setSellerAmountOnHold(false)
              localStorage.setItem(creditedKey, 'true')
              setTransferCompleted(true)
              
              // Force a re-render to ensure UI updates
              forceUpdate(prev => prev + 1)
              
              // Dispatch custom event to notify listeners of localStorage change
              window.dispatchEvent(new CustomEvent('localStorageChange', {
                detail: { key: sellerWalletKey, newValue: sellerBalance.toString() }
              }))
              
              // Delay status message to ensure state updates are processed
              setTimeout(() => {
                handleStatus({ 
                  type: 'success', 
                  message: `Transaction completed! ₱${activeTransaction.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })} has been added to your wallet. ₱${SELLER_HOLD_AMOUNT.toLocaleString(undefined, { minimumFractionDigits: 2 })} hold released.` 
                })
              }, 100)
            } else {
              // Already credited, just update the state from localStorage
              const sellerWalletKey = 'wallet_balance_seller'
              const currentSellerBalance = localStorage.getItem(sellerWalletKey)
              if (currentSellerBalance) {
                const balance = parseFloat(currentSellerBalance)
                lastBalanceRef.current = balance
                setSellerWalletBalance(() => balance)
              }
              setTransferCompleted(true)
            }
          } else if (payload.completed && transferCompleted) {
            // Transaction is completed, ensure balance is up to date
            const sellerWalletKey = 'wallet_balance_seller'
            const currentSellerBalance = localStorage.getItem(sellerWalletKey)
            if (currentSellerBalance) {
              const balance = parseFloat(currentSellerBalance)
              // Only update if value changed to prevent unnecessary re-renders
              if (balance !== lastBalanceRef.current) {
                lastBalanceRef.current = balance
                setSellerWalletBalance(() => balance)
                // Dispatch custom event to notify listeners
                window.dispatchEvent(new CustomEvent('localStorageChange', {
                  detail: { key: sellerWalletKey, newValue: balance.toString() }
                }))
              }
            }
          }
        }
      }
      
      // Check immediately
      checkCompletedTransaction()
      
      // Poll periodically to catch completed transactions
      const interval = setInterval(checkCompletedTransaction, 500)
      return () => clearInterval(interval)
    }
  }, [connected, activeTransaction, isSeller, deviceType, transferCompleted, addBalance, setDeviceType])

  function handleBuyerConfirm() {
    if (!activeTransaction) return
    
    setBuyerConfirmed(true)
    
    // Save buyer confirmation to localStorage
    const transactionKey = `txn_${activeTransaction.buyerId}`
    const storedData = localStorage.getItem(transactionKey)
    if (storedData) {
      const payload = JSON.parse(storedData)
      payload.buyerConfirmed = true
      localStorage.setItem(transactionKey, JSON.stringify(payload))
    }
    
    handleStatus({ type: 'success', message: 'Buyer confirmation received!' })
    
    // Check if both confirmed
    if (sellerConfirmed) {
      handleTransferToSeller()
    }
  }

  function handleSellerConfirm() {
    if (!activeTransaction) return
    
    // Seller can only confirm after buyer has confirmed
    if (!buyerConfirmed) {
      handleStatus({ type: 'error', message: 'Please wait for buyer to confirm first.' })
      return
    }
    
    console.log('🔵 Seller confirming transaction:', activeTransaction.buyerId)
    
    setSellerConfirmed(true)
    
    // Save seller confirmation to localStorage
    const transactionKey = `txn_${activeTransaction.buyerId}`
    const storedData = localStorage.getItem(transactionKey)
    if (storedData) {
      const payload = JSON.parse(storedData)
      payload.sellerConfirmed = true
      localStorage.setItem(transactionKey, JSON.stringify(payload))
    }
    
    handleStatus({ type: 'success', message: 'Seller confirmation received!' })
    
    // Both confirmed, transfer to seller
    // This will update the wallet balance and the state will be updated immediately
    console.log('💸 Triggering transfer to seller...')
    handleTransferToSeller()
    
    // Force an immediate balance update check
    setTimeout(() => {
      const sellerWalletKey = 'wallet_balance_seller'
      const currentBalance = localStorage.getItem(sellerWalletKey)
      if (currentBalance) {
        const balance = parseFloat(currentBalance)
        console.log('🔄 Force updating balance from localStorage:', balance)
        lastBalanceRef.current = balance
        setSellerWalletBalance(() => balance)
        forceUpdate(prev => prev + 1)
      }
    }, 50)
  }

  // Helper function to get minimum extension date (current expiry + 1 day)
  function getMinExtensionDate(): string {
    if (!activeTransaction) {
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      return tomorrow.toISOString().split('T')[0]
    }
    
    const transactionKey = `txn_${activeTransaction.buyerId}`
    const storedData = localStorage.getItem(transactionKey)
    if (!storedData) {
      const tomorrow = new Date()
      tomorrow.setDate(tomorrow.getDate() + 1)
      return tomorrow.toISOString().split('T')[0]
    }
    
    const payload = JSON.parse(storedData)
    let currentExpiryTime: number | null = null
    if (payload.protectionWindowExpiryDate) {
      currentExpiryTime = payload.protectionWindowExpiryDate
    } else if (payload.protectionWindowDays || payload.protectionWindowHours) {
      const daysInMs = (payload.protectionWindowDays || 0) * 24 * 60 * 60 * 1000
      const hoursInMs = (payload.protectionWindowHours || 0) * 60 * 60 * 1000
      currentExpiryTime = payload.createdAt + daysInMs + hoursInMs
    }
    
    if (currentExpiryTime) {
      const currentExpiryDate = new Date(currentExpiryTime)
      const nextDay = new Date(currentExpiryDate)
      nextDay.setDate(nextDay.getDate() + 1)
      return nextDay.toISOString().split('T')[0]
    }
    
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    return tomorrow.toISOString().split('T')[0]
  }

  // Helper function to get extension request date from days/hours
  function getExtensionRequestDate(): string | null {
    if (!activeTransaction || !activeTransaction.extensionRequested) return null
    
    const transactionKey = `txn_${activeTransaction.buyerId}`
    const storedData = localStorage.getItem(transactionKey)
    if (!storedData) return null
    
    const payload = JSON.parse(storedData)
    let currentExpiryTime: number | null = null
    if (payload.protectionWindowExpiryDate) {
      currentExpiryTime = payload.protectionWindowExpiryDate
    } else if (payload.protectionWindowDays || payload.protectionWindowHours) {
      const daysInMs = (payload.protectionWindowDays || 0) * 24 * 60 * 60 * 1000
      const hoursInMs = (payload.protectionWindowHours || 0) * 60 * 60 * 1000
      currentExpiryTime = payload.createdAt + daysInMs + hoursInMs
    }
    
    if (!currentExpiryTime) return null
    
    const currentExpiryDate = new Date(currentExpiryTime)
    const extensionDays = activeTransaction.extensionRequestDays || 0
    const extensionHours = activeTransaction.extensionRequestHours || 0
    const extensionDate = new Date(currentExpiryDate)
    extensionDate.setDate(extensionDate.getDate() + extensionDays)
    extensionDate.setHours(extensionDate.getHours() + extensionHours)
    
    return extensionDate.toISOString().split('T')[0]
  }

  function handleSellerRequestExtension() {
    if (!activeTransaction) return
    
    if (!extensionRequestDate) {
      handleStatus({ type: 'error', message: 'Please select an extension date.' })
      return
    }
    
    const selectedDate = new Date(extensionRequestDate)
    const now = new Date()
    
    if (selectedDate <= now) {
      handleStatus({ type: 'error', message: 'Extension date must be in the future.' })
      return
    }
    
    // Get current protection window expiry date
    const transactionKey = `txn_${activeTransaction.buyerId}`
    const storedData = localStorage.getItem(transactionKey)
    if (!storedData) {
      handleStatus({ type: 'error', message: 'Transaction data not found.' })
      return
    }
    
    const payload = JSON.parse(storedData)
    
    // Get current expiry time
    let currentExpiryTime: number | null = null
    if (payload.protectionWindowExpiryDate) {
      currentExpiryTime = payload.protectionWindowExpiryDate
    } else if (payload.protectionWindowDays || payload.protectionWindowHours) {
      // Legacy support
      const daysInMs = (payload.protectionWindowDays || 0) * 24 * 60 * 60 * 1000
      const hoursInMs = (payload.protectionWindowHours || 0) * 60 * 60 * 1000
      currentExpiryTime = payload.createdAt + daysInMs + hoursInMs
    }
    
    if (!currentExpiryTime) {
      handleStatus({ type: 'error', message: 'Protection window expiry not found.' })
      return
    }
    
    const currentExpiryDate = new Date(currentExpiryTime)
    
    // Check if selected date is after current expiry
    if (selectedDate <= currentExpiryDate) {
      handleStatus({ type: 'error', message: 'Extension date must be after the current protection window expiry date.' })
      return
    }
    
    // Calculate days and hours from current expiry to selected date
    const diffMs = selectedDate.getTime() - currentExpiryDate.getTime()
    const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000))
    const diffHours = Math.floor((diffMs % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000))
    
    if (diffDays === 0 && diffHours === 0) {
      handleStatus({ type: 'error', message: 'Extension must be at least 1 hour.' })
      return
    }
    
    if (activeTransaction.completed || activeTransaction.expired) {
      handleStatus({ type: 'error', message: 'Cannot request extension for completed or expired transactions.' })
      return
    }
    
    // Save extension request to localStorage
    payload.extensionRequested = true
    payload.extensionRequestDays = diffDays
    payload.extensionRequestHours = diffHours
    payload.extensionApproved = false // Reset approval status
    localStorage.setItem(transactionKey, JSON.stringify(payload))
    setActiveTransaction(payload)
    
    handleStatus({ type: 'success', message: `Extension request sent! Requesting extension until ${selectedDate.toLocaleDateString()}.` })
    
    // Reset to tomorrow
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    setExtensionRequestDate(tomorrow.toISOString().split('T')[0])
    setShowExtensionModal(false)
  }


  function handleBuyerApproveExtension() {
    if (!activeTransaction) return
    
    if (activeTransaction.completed || activeTransaction.expired) {
      handleStatus({ type: 'error', message: 'Cannot approve extension for completed or expired transactions.' })
      return
    }
    
    // Use the seller's requested extension values
    const days = activeTransaction.extensionRequestDays ?? 0
    const hours = activeTransaction.extensionRequestHours ?? 0
    
    if (days === 0 && hours === 0) {
      handleStatus({ type: 'error', message: 'Invalid extension request.' })
      return
    }
    
    // Save extension approval to localStorage
    const transactionKey = `txn_${activeTransaction.buyerId}`
    const storedData = localStorage.getItem(transactionKey)
    if (storedData) {
      const payload = JSON.parse(storedData)
      payload.extensionApproved = true
      payload.extensionApprovedDays = days
      payload.extensionApprovedHours = hours
      payload.extensionApprovedAt = Date.now()
      localStorage.setItem(transactionKey, JSON.stringify(payload))
      setActiveTransaction(payload)
    }
    
    handleStatus({ type: 'success', message: `Extension approved! Protection window extended by ${days}d ${hours}h.` })
  }

  // Add funds to buyer wallet
  function handleAddFundsToBuyer() {
    const amount = parseFloat(addFundsBuyerAmount)
    if (!isNaN(amount) && amount > 0) {
      const currentBalance = parseFloat(localStorage.getItem('wallet_balance_buyer') || '10000')
      const newBalance = currentBalance + amount
      localStorage.setItem('wallet_balance_buyer', newBalance.toString())
      setBuyerWalletBalance(newBalance)
      
      // Dispatch custom event to notify other components
      window.dispatchEvent(new CustomEvent('localStorageChange', {
        detail: { key: 'wallet_balance_buyer', newValue: newBalance.toString() }
      }))
      
      setAddFundsBuyerAmount('')
      handleStatus({ type: 'success', message: `Added ₱${amount.toFixed(2)} to Buyer wallet. New balance: ₱${newBalance.toFixed(2)}` })
    } else {
      handleStatus({ type: 'error', message: 'Please enter a valid amount.' })
    }
  }

  // Add funds to seller wallet
  function handleAddFundsToSeller() {
    const amount = parseFloat(addFundsSellerAmount)
    if (!isNaN(amount) && amount > 0) {
      const currentBalance = parseFloat(localStorage.getItem('wallet_balance_seller') || '5000')
      const newBalance = currentBalance + amount
      localStorage.setItem('wallet_balance_seller', newBalance.toString())
      setSellerWalletBalance(newBalance)
      lastBalanceRef.current = newBalance
      
      // Dispatch custom event to notify other components
      window.dispatchEvent(new CustomEvent('localStorageChange', {
        detail: { key: 'wallet_balance_seller', newValue: newBalance.toString() }
      }))
      
      setAddFundsSellerAmount('')
      handleStatus({ type: 'success', message: `Added ₱${amount.toFixed(2)} to Seller wallet. New balance: ₱${newBalance.toFixed(2)}` })
    } else {
      handleStatus({ type: 'error', message: 'Please enter a valid amount.' })
    }
  }

  // Clear transaction data from localStorage (except wallet values)
  function clearTransactionData(transactionId: string) {
    // List of wallet keys to preserve
    const walletKeys = ['wallet_balance_buyer', 'wallet_balance_seller', 'wallet_balance']
    
    // Clear transaction-related keys
    const keysToRemove = [
      `txn_${transactionId}`,
      `credited_${transactionId}`,
      `expired_${transactionId}`
    ]
    
    keysToRemove.forEach(key => {
      if (!walletKeys.includes(key)) {
        localStorage.removeItem(key)
      }
    })
  }

  // Clear all transaction keys from localStorage (except wallet values)
  function clearAllTransactions() {
    // List of wallet keys to preserve
    const walletKeys = ['wallet_balance_buyer', 'wallet_balance_seller', 'wallet_balance', 'device_type', 'phone_number']
    
    // Get all keys from localStorage
    const allKeys = Object.keys(localStorage)
    
    // Clear all transaction-related keys
    allKeys.forEach(key => {
      // Remove keys that start with txn_, credited_, or expired_
      if ((key.startsWith('txn_') || key.startsWith('credited_') || key.startsWith('expired_')) && !walletKeys.includes(key)) {
        localStorage.removeItem(key)
      }
    })
    
    // Reset state
    setInviteLink(null)
    setInvitePayload(null)
    setActiveTransaction(null)
    setConnected(false)
    setBuyerConfirmed(false)
    setSellerConfirmed(false)
    setAmountHeldInEscrow(false)
    setTransferCompleted(false)
    setSellerConnected(false)
    setSellerAmountOnHold(false)
    
    handleStatus({ type: 'success', message: 'All transaction data cleared from localStorage.' })
  }

  // Skip protection window to 5 seconds before expiration
  function skipProtectionWindow() {
    if (!activeTransaction) {
      handleStatus({ type: 'error', message: 'No active transaction found.' })
      return
    }

    if (activeTransaction.completed || activeTransaction.expired) {
      handleStatus({ type: 'error', message: 'Cannot skip protection window for completed or expired transactions.' })
      return
    }

    const transactionKey = `txn_${activeTransaction.buyerId}`
    const storedData = localStorage.getItem(transactionKey)
    
    if (!storedData) {
      handleStatus({ type: 'error', message: 'Transaction data not found in localStorage.' })
      return
    }

    const payload = JSON.parse(storedData)
    
    // Get the protection window expiry time
    let expiryTime: number | null = null
    
    if (payload.protectionWindowExpiryDate) {
      expiryTime = payload.protectionWindowExpiryDate
    } else if (payload.protectionWindowDays || payload.protectionWindowHours) {
      // Legacy support: calculate from days/hours
      const daysInMs = (payload.protectionWindowDays || 0) * 24 * 60 * 60 * 1000
      const hoursInMs = (payload.protectionWindowHours || 0) * 60 * 60 * 1000
      expiryTime = payload.createdAt + daysInMs + hoursInMs
    }
    
    if (!expiryTime) {
      handleStatus({ type: 'error', message: 'Protection window not found in transaction data.' })
      return
    }
    
    // If extension was approved, add the extension time
    if (payload.extensionApproved && payload.extensionApprovedAt) {
      const extensionDaysInMs = (payload.extensionApprovedDays || 0) * 24 * 60 * 60 * 1000
      const extensionHoursInMs = (payload.extensionApprovedHours || 0) * 60 * 60 * 1000
      expiryTime = expiryTime + extensionDaysInMs + extensionHoursInMs
    }
    
    // Calculate new createdAt so that expiry is 5 seconds from now
    // We want: expiry = now + 5000
    // Therefore: createdAt = now + 5000 - (expiryTime - originalCreatedAt)
    const now = Date.now()
    const fiveSecondsFromNow = now + 5000
    const originalDuration = expiryTime - payload.createdAt
    payload.createdAt = fiveSecondsFromNow - originalDuration
    
    // Update the expiry date to match
    if (payload.protectionWindowExpiryDate) {
      payload.protectionWindowExpiryDate = fiveSecondsFromNow
    }
    
    // Save updated payload
    localStorage.setItem(transactionKey, JSON.stringify(payload))
    setActiveTransaction(payload)
    
    handleStatus({ type: 'success', message: 'Protection window skipped to 5 seconds before expiration.' })
  }

  function handleTransferToSeller() {
    if (!activeTransaction) return
    
    // Mark transaction as completed in localStorage so seller's device can see it
    const transactionKey = `txn_${activeTransaction.buyerId}`
    const storedData = localStorage.getItem(transactionKey)
    if (storedData) {
      const payload = JSON.parse(storedData)
      payload.completed = true
      payload.completedAt = Date.now()
      localStorage.setItem(transactionKey, JSON.stringify(payload))
    }
    
    // Always update seller's wallet in localStorage when transaction completes
    // This ensures the wallet is updated regardless of which device triggers the completion
    const creditedKey = `credited_${activeTransaction.buyerId}`
    const alreadyCredited = localStorage.getItem(creditedKey)
    
    if (!alreadyCredited) {
      const sellerWalletKey = 'wallet_balance_seller'
      const currentSellerBalance = localStorage.getItem(sellerWalletKey)
      const sellerBalance = currentSellerBalance ? parseFloat(currentSellerBalance) : 5000.00
      // Release held amount and add transaction amount
      const newSellerBalance = sellerBalance + activeTransaction.amount + SELLER_HOLD_AMOUNT
      localStorage.setItem(sellerWalletKey, newSellerBalance.toString())
      localStorage.setItem(creditedKey, 'true')
      
      // Mark that hold has been released
      if (storedData) {
        const payload = JSON.parse(storedData)
        payload.sellerAmountOnHold = false
        payload.holdReleased = true
        localStorage.setItem(transactionKey, JSON.stringify(payload))
      }
      
      // Update sellerWalletBalance state immediately if we're on the seller's device
      if (isSeller && connected) {
        console.log('💰 Updating seller balance:', {
          oldBalance: sellerBalance,
          newBalance: newSellerBalance,
          transactionAmount: activeTransaction.amount,
          holdAmount: SELLER_HOLD_AMOUNT
        })
        
        // Ensure device type is set to seller for wallet context update
        if (deviceType !== 'seller') {
          setDeviceType('seller')
        }
        
        // Update ref first, then state to ensure consistency
        lastBalanceRef.current = newSellerBalance
        
        // Update all related states in sequence
        setSellerWalletBalance(() => {
          console.log('✅ Setting seller wallet balance to:', newSellerBalance)
          return newSellerBalance
        })
        setSellerAmountOnHold(false)
        setTransferCompleted(true)
        
        // Force multiple re-renders to ensure UI updates
        forceUpdate(prev => prev + 1)
        
        // Additional force update after a microtask to ensure React processes the change
        Promise.resolve().then(() => {
          forceUpdate(prev => prev + 1)
        })
        
        // Show success message after state updates
        setTimeout(() => {
          console.log('📢 Showing success message. Current balance:', newSellerBalance)
          handleStatus({ 
            type: 'success', 
            message: `Transaction completed! ₱${activeTransaction.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })} has been added to your wallet. ₱${SELLER_HOLD_AMOUNT.toLocaleString(undefined, { minimumFractionDigits: 2 })} hold released.` 
          })
        }, 100)
      } else if (isBuyer) {
        // Buyer sees transfer completed message
        handleStatus({ 
          type: 'success', 
          message: `Transfer completed! ₱${activeTransaction.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })} has been transferred to the seller.` 
        })
      }
      
      // Dispatch custom event to notify listeners of localStorage change AFTER state updates
      window.dispatchEvent(new CustomEvent('localStorageChange', {
        detail: { key: sellerWalletKey, newValue: newSellerBalance.toString() }
      }))
    } else {
      // Already credited, but ensure state is updated if on seller's device
      if (isSeller && connected) {
        const sellerWalletKey = 'wallet_balance_seller'
        const currentSellerBalance = localStorage.getItem(sellerWalletKey)
        if (currentSellerBalance) {
          const balance = parseFloat(currentSellerBalance)
          lastBalanceRef.current = balance
          setSellerWalletBalance(() => balance)
        }
        setTransferCompleted(true)
      }
    }
    
    setTransferCompleted(true)
    
    // Clear transaction data from localStorage after a short delay to ensure wallet updates are complete
    setTimeout(() => {
      clearTransactionData(activeTransaction.buyerId)
    }, 1000)
  }

  // Calculate protection window expiration time
  const getProtectionWindowExpiry = (transaction: TransactionInvite): number | null => {
    // For backward compatibility, check if old format exists
    if (!transaction.protectionWindowExpiryDate) {
      // Legacy support: calculate from days/hours if they exist
      if (transaction.protectionWindowDays || transaction.protectionWindowHours) {
        const daysInMs = (transaction.protectionWindowDays || 0) * 24 * 60 * 60 * 1000
        const hoursInMs = (transaction.protectionWindowHours || 0) * 60 * 60 * 1000
        let baseExpiry = transaction.createdAt + daysInMs + hoursInMs
        
        // If extension was approved, add the extension time
        if (transaction.extensionApproved && transaction.extensionApprovedAt) {
          const extensionDaysInMs = (transaction.extensionApprovedDays || 0) * 24 * 60 * 60 * 1000
          const extensionHoursInMs = (transaction.extensionApprovedHours || 0) * 60 * 60 * 1000
          baseExpiry = baseExpiry + extensionDaysInMs + extensionHoursInMs
        }
        
        return baseExpiry
      }
      return null
    }
    
    let baseExpiry = transaction.protectionWindowExpiryDate
    
    // If extension was approved, add the extension time
    if (transaction.extensionApproved && transaction.extensionApprovedAt) {
      const extensionDaysInMs = (transaction.extensionApprovedDays || 0) * 24 * 60 * 60 * 1000
      const extensionHoursInMs = (transaction.extensionApprovedHours || 0) * 60 * 60 * 1000
      // Extend from the original expiry time
      baseExpiry = baseExpiry + extensionDaysInMs + extensionHoursInMs
    }
    
    return baseExpiry
  }

  // Format time remaining for protection window
  const getProtectionWindowTimeRemaining = (transaction: TransactionInvite): string | null => {
    if (transaction.expired || transaction.completed) {
      if (transaction.expired) {
        return 'Expired'
      }
      return null
    }
    const expiryTime = getProtectionWindowExpiry(transaction)
    if (!expiryTime) return null
    
    const now = Date.now()
    const remaining = expiryTime - now
    
    if (remaining <= 0) {
      return 'Expired'
    }
    
    const days = Math.floor(remaining / (24 * 60 * 60 * 1000))
    const hours = Math.floor((remaining % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000))
    const minutes = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000))
    
    if (days > 0) {
      return `${days}d ${hours}h ${minutes}m`
    } else if (hours > 0) {
      return `${hours}h ${minutes}m`
    } else {
      return `${minutes}m`
    }
  }

  // Check if protection window has expired
  const isProtectionWindowExpired = (transaction: TransactionInvite): boolean => {
    if (transaction.expired || transaction.completed) {
      return transaction.expired || false
    }
    const expiryTime = getProtectionWindowExpiry(transaction)
    if (!expiryTime) return false
    return Date.now() >= expiryTime
  }

  // Handle protection window expiration
  const handleProtectionWindowExpiry = (transaction: TransactionInvite) => {
    if (transaction.expired || transaction.completed) {
      return
    }

    const transactionKey = `txn_${transaction.buyerId}`
    const storedData = localStorage.getItem(transactionKey)
    if (!storedData) return

    const payload = JSON.parse(storedData)
    
    // Check if already processed
    const expiredKey = `expired_${transaction.buyerId}`
    const alreadyProcessed = localStorage.getItem(expiredKey)
    
    if (!alreadyProcessed) {
      // Mark as expired
      payload.expired = true
      payload.expiredAt = Date.now()
      localStorage.setItem(transactionKey, JSON.stringify(payload))
      localStorage.setItem(expiredKey, 'true')

      // If amount is held in escrow, return it to buyer along with transaction fee
      if (payload.amountHeldInEscrow && !payload.completed) {
        // Return amount and transaction fee to buyer
        // Ensure device type is buyer for wallet context
        if (deviceType !== 'buyer') {
          setDeviceType('buyer')
        }
        addBalance(transaction.amount + TRANSACTION_FEE)
        
        // Show buyer refund message
        if (isBuyer) {
          handleStatus({ 
            type: 'success', 
            message: `Protection Window Expired - Funds Refunded: ₱${payload.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })} and transaction fee of ₱${TRANSACTION_FEE.toLocaleString(undefined, { minimumFractionDigits: 2 })} have been returned to your wallet.` 
          })
        }
      }

      // If seller has amount on hold, it stays deducted (already deducted when seller connected)
      // Just mark it as not released
      if (payload.sellerAmountOnHold && !payload.holdReleased) {
        payload.holdReleased = false
        payload.sellerAmountOnHold = false
        localStorage.setItem(transactionKey, JSON.stringify(payload))
        
        // Show seller transaction failed message
        if (isSeller) {
          handleStatus({ 
            type: 'error', 
            message: `Transaction Failed - Protection Window Expired: ₱${SELLER_HOLD_AMOUNT.toLocaleString(undefined, { minimumFractionDigits: 2 })} hold amount has been deducted from your wallet.` 
          })
        }
      }
    }

    // Update active transaction state
    setActiveTransaction(payload)
    // Don't set transferCompleted for expired transactions - it should only be for successful transfers
    
    // Clear transaction data from localStorage after a short delay to ensure wallet updates are complete
    setTimeout(() => {
      clearTransactionData(transaction.buyerId)
    }, 1000)
  }

  // Update countdown display every second
  useEffect(() => {
    if (!activeTransaction || activeTransaction.completed || activeTransaction.expired) {
      return
    }

    const interval = setInterval(() => {
      setCountdownUpdate(prev => prev + 1)
    }, 1000)

    return () => clearInterval(interval)
  }, [activeTransaction])

  // Check for protection window expiration periodically
  useEffect(() => {
    if (!activeTransaction) {
      return
    }

    const checkExpiration = () => {
      // Always check from localStorage to sync across tabs
      const transactionKey = `txn_${activeTransaction.buyerId}`
      const storedData = localStorage.getItem(transactionKey)
      if (!storedData) return

      const payload = JSON.parse(storedData)
      
      // If already expired, just update state without showing messages again
      if (payload.expired && !activeTransaction.expired) {
        setActiveTransaction(payload)
        return
      }

      // If completed, don't check expiration
      if (payload.completed || payload.expired) {
        return
      }

      // Check if expired
      if (isProtectionWindowExpired(payload)) {
        handleProtectionWindowExpiry(payload)
      }
    }

    // Check immediately
    checkExpiration()

    // Check every minute
    const interval = setInterval(checkExpiration, 60000)
    return () => clearInterval(interval)
  }, [activeTransaction, isBuyer, isSeller, addBalance, deviceType, setDeviceType, countdownUpdate])

  // Auto-set device type based on role
  useEffect(() => {
    if (isBuyer) {
      setDeviceType('buyer')
    } else if (isSeller) {
      setDeviceType('seller')
    }
  }, [isBuyer, isSeller, setDeviceType])

  // Ref to track last balance value to prevent unnecessary updates
  const lastBalanceRef = useRef<number>(sellerWalletBalance)

  // Update seller wallet balance from localStorage - only triggers on value change
  useEffect(() => {
    if (isSeller || deviceType === 'seller') {
      const updateSellerBalance = () => {
        const stored = localStorage.getItem('wallet_balance_seller')
        if (stored) {
          const newBalance = parseFloat(stored)
          // Only update if value actually changed
          if (newBalance !== lastBalanceRef.current) {
            lastBalanceRef.current = newBalance
            // Use functional update to ensure React processes the change
            setSellerWalletBalance(() => newBalance)
            // Force a re-render
            forceUpdate(prev => prev + 1)
          }
        }
      }
      
      // Initial load
      updateSellerBalance()
      
      // Listen for storage events (cross-tab/window updates)
      const handleStorageChange = (e: StorageEvent) => {
        if (e.key === 'wallet_balance_seller' && e.newValue) {
          const newBalance = parseFloat(e.newValue)
          if (newBalance !== lastBalanceRef.current) {
            lastBalanceRef.current = newBalance
            setSellerWalletBalance(() => newBalance)
            forceUpdate(prev => prev + 1)
          }
        }
      }
      
      // Listen for custom storage change events (same-tab updates)
      const handleCustomStorageChange = (e: Event) => {
        const customEvent = e as CustomEvent
        if (customEvent.detail?.key === 'wallet_balance_seller' && customEvent.detail?.newValue) {
          const newBalance = parseFloat(customEvent.detail.newValue)
          // Always update state when custom event is fired to ensure UI syncs
          lastBalanceRef.current = newBalance
          setSellerWalletBalance(() => newBalance)
          forceUpdate(prev => prev + 1)
        } else if (customEvent.detail?.key === 'wallet_balance_seller') {
          // Fallback to reading from localStorage
          updateSellerBalance()
        }
      }
      
      window.addEventListener('storage', handleStorageChange)
      window.addEventListener('localStorageChange', handleCustomStorageChange as EventListener)
      
      // Poll localStorage for same-tab updates more frequently during active transactions
      const pollInterval = connected && activeTransaction ? 200 : 500
      const interval = setInterval(updateSellerBalance, pollInterval)
      
      return () => {
        window.removeEventListener('storage', handleStorageChange)
        window.removeEventListener('localStorageChange', handleCustomStorageChange as EventListener)
        clearInterval(interval)
      }
    }
  }, [isSeller, deviceType, connected, activeTransaction])

  // Force update seller balance when transaction completes
  useEffect(() => {
    if (transferCompleted && isSeller) {
      console.log('🎉 Transaction completed! Force updating seller balance...')
      const sellerWalletKey = 'wallet_balance_seller'
      const currentBalance = localStorage.getItem(sellerWalletKey)
      if (currentBalance) {
        const balance = parseFloat(currentBalance)
        console.log('💵 Final balance from localStorage:', balance)
        lastBalanceRef.current = balance
        setSellerWalletBalance(() => balance)
        forceUpdate(prev => prev + 1)
      }
    }
  }, [transferCompleted, isSeller])

  // Ref to track last buyer balance value to prevent unnecessary updates
  const lastBuyerBalanceRef = useRef<number>(buyerWalletBalance)

  // Update buyer wallet balance from localStorage
  useEffect(() => {
    const updateBuyerBalance = () => {
      const stored = localStorage.getItem('wallet_balance_buyer')
      if (stored) {
        const newBalance = parseFloat(stored)
        // Only update if value actually changed
        if (newBalance !== lastBuyerBalanceRef.current) {
          lastBuyerBalanceRef.current = newBalance
          setBuyerWalletBalance(newBalance)
        }
      } else {
        // Initialize buyer balance if it doesn't exist
        const initialBalance = 10000.00
        localStorage.setItem('wallet_balance_buyer', initialBalance.toString())
        lastBuyerBalanceRef.current = initialBalance
        setBuyerWalletBalance(initialBalance)
      }
    }
    
    // Initial load
    updateBuyerBalance()
    
    // Listen for storage events (cross-tab/window updates)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'wallet_balance_buyer' && e.newValue) {
        const newBalance = parseFloat(e.newValue)
        if (newBalance !== lastBuyerBalanceRef.current) {
          lastBuyerBalanceRef.current = newBalance
          setBuyerWalletBalance(newBalance)
        }
      }
    }
    
    // Listen for custom storage change events (same-tab updates)
    const handleCustomStorageChange = (e: Event) => {
      const customEvent = e as CustomEvent
      if (customEvent.detail?.key === 'wallet_balance_buyer' && customEvent.detail?.newValue) {
        const newBalance = parseFloat(customEvent.detail.newValue)
        // Always update state when custom event is fired to ensure UI syncs
        lastBuyerBalanceRef.current = newBalance
        setBuyerWalletBalance(newBalance)
      } else if (customEvent.detail?.key === 'wallet_balance_buyer') {
        // Fallback to reading from localStorage
        updateBuyerBalance()
      }
    }
    
    window.addEventListener('storage', handleStorageChange)
    window.addEventListener('localStorageChange', handleCustomStorageChange as EventListener)
    
    // Poll localStorage for same-tab updates (only updates if value changed)
    const interval = setInterval(updateBuyerBalance, 100)
    
    return () => {
      window.removeEventListener('storage', handleStorageChange)
      window.removeEventListener('localStorageChange', handleCustomStorageChange as EventListener)
      clearInterval(interval)
    }
  }, [])

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#E6F0FF] via-[#F9FAFB] to-[#FFFFFF] text-[#1A1A1A] relative">
      {/* Dev Tools Panel - positioned outside main container */}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-3">
        {/* Dev Tools Header */}
        <div className="rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-3 py-2 shadow-lg">
          <div className="flex items-center gap-2">
            <svg className="h-4 w-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
            </svg>
            <span className="text-xs font-bold text-white uppercase tracking-wide">Dev Tools</span>
          </div>
        </div>

        {/* Add Funds Button */}
        <button
          onClick={() => setShowAddFundsModal(true)}
          className="group relative rounded-xl border-2 border-[#10B981] bg-white p-3 text-[#10B981] shadow-lg transition-all hover:bg-[#10B981] hover:scale-105 hover:shadow-xl active:scale-95"
          title="Add funds to buyer or seller wallet"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-6 w-6 transition-colors group-hover:text-white"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 6v6m0 0v6m0-6h6m-6 0H6"
            />
          </svg>
          <span className="absolute -left-2 top-1/2 -translate-y-1/2 -translate-x-full whitespace-nowrap rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-medium text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 pointer-events-none">
            Add funds to wallets
          </span>
        </button>

        {/* Skip Protection Window Button */}
        <button
          onClick={skipProtectionWindow}
          className="group relative rounded-xl border-2 border-[#F59E0B] bg-white p-3 text-[#F59E0B] shadow-lg transition-all hover:bg-[#F59E0B] hover:scale-105 hover:shadow-xl active:scale-95"
          title="Skip protection window to 5 seconds before expiration"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-6 w-6 transition-colors group-hover:text-white"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M13 10V3L4 14h7v7l9-11h-7z"
            />
          </svg>
          <span className="absolute -left-2 top-1/2 -translate-y-1/2 -translate-x-full whitespace-nowrap rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-medium text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 pointer-events-none">
            Skip to 5s before expiry
          </span>
        </button>

        {/* Clear All Transactions Button */}
        <button
          onClick={clearAllTransactions}
          className="group relative rounded-xl border-2 border-[#EF4444] bg-white p-3 text-[#EF4444] shadow-lg transition-all hover:bg-[#EF4444] hover:scale-105 hover:shadow-xl active:scale-95"
          title="Clear all transaction data from localStorage"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-6 w-6 transition-colors group-hover:text-white"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
            />
          </svg>
          <span className="absolute -left-2 top-1/2 -translate-y-1/2 -translate-x-full whitespace-nowrap rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-medium text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 pointer-events-none">
            Clear all transactions
          </span>
        </button>

        {/* Info Badge */}
        <div className="rounded-lg bg-white/90 backdrop-blur-sm px-2 py-1 shadow-md border border-gray-200">
          <p className="text-[9px] font-medium text-gray-600 text-center">
            Dev Mode
          </p>
        </div>
      </div>

      <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-4 py-6">
        <header className="mb-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-1">
              <span className="text-sm font-medium tracking-wide text-[#666666]">GAssure Escrow</span>
              <h1 className="text-3xl font-semibold text-[#1A1A1A]">Transaction System</h1>
              
            </div>
            <button
              onClick={() => navigate('/')}
              className="w-full rounded-xl bg-[#0066FF] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#0052CC] sm:w-auto"
            >
              ← Back to Dashboard
            </button>
          </div>
        </header>

        {status && (
          <div
            className={`mb-4 rounded-2xl border px-4 py-3 text-sm font-medium ${
              status.type === 'success'
                ? 'border-[#10B981]/30 bg-[#D1FAE5] text-[#065F46]'
                : 'border-[#EF4444]/30 bg-[#FEE2E2] text-[#B91C1C]'
            }`}
          >
            {status.message}
          </div>
        )}

        <main className="flex flex-1 flex-col gap-6">
          <div className="grid flex-1 gap-6 lg:grid-cols-2">
            {/* Buyer Section */}
            <section className="relative flex w-full h-full flex-col gap-4 rounded-[32px] border-[3px] border-black bg-white/95 px-5 py-6 shadow-[0_20px_48px_rgba(15,23,42,0.08)]">
              <span className="pointer-events-none absolute left-1/2 top-0 h-6 w-32 -translate-x-1/2 transform rounded-b-3xl bg-[#1A1A1A]/90" />
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#666666]">Buyer</p>
                  <h2 className="text-2xl font-semibold text-[#1A1A1A]">Create Transaction</h2>
                </div>
                <span className="rounded-full bg-[#E6F0FF] px-3 py-1 text-xs font-semibold text-[#0066FF]">Device A</span>
              </div>

              {/* Current Wallet Value and Phone Number */}
              <div className="rounded-2xl border border-[#E5E7EB] bg-gradient-to-r from-[#F0F7FF] to-[#E6F0FF] p-4">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <p className="text-xs font-medium text-[#666666]">Wallet balance</p>
                    <p
                      className="text-xl font-bold text-[#1A1A1A]"
                      style={{ fontFamily: '"Gotham Rounded", "Karla", sans-serif' }}
                    >
                      ₱{buyerWalletBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-[#666666]">Phone Number</p>
                    <p className="text-lg font-semibold text-[#1A1A1A]">
                      {mockBuyerPhoneNumber}
                    </p>
                  </div>
                </div>
              </div>

              {!inviteLink && !activeTransaction && (
                <div className="rounded-2xl border border-[#E5E7EB] bg-white/95 p-4">
                  <div className="mb-3">
                    <h3 className="text-lg font-semibold text-[#1A1A1A]">Create Transaction</h3>
                    <p className="text-xs text-[#666666]">
                      Enter the transaction details and send a request to the seller. The seller will receive the request automatically.
                    </p>
                  </div>
                  <div className="flex flex-col gap-3">
                    <label className="text-sm font-medium text-[#333333]">
                      Amount
                      <input
                        type="number"
                        min={MIN_TRANSACTION_AMOUNT}
                        step="0.01"
                        value={transactionAmount}
                        onChange={(event) => setTransactionAmount(event.target.value)}
                        className="mt-1 w-full rounded-xl border border-[#E5E7EB] bg-white px-3 py-2 text-sm text-[#1A1A1A] outline-none transition focus:border-[#0066FF] focus:ring-2 focus:ring-[#4D9FFF]/40"
                        placeholder="5000"
                        required
                      />
                      <p className="mt-1 text-xs text-[#666666]">
                        Minimum transaction amount: ₱{MIN_TRANSACTION_AMOUNT.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </p>
                    </label>
                    <label className="text-sm font-medium text-[#333333]">
                      Seller's GCash Number
                      <input
                        type="tel"
                        value={sellerPhoneNumber}
                        onChange={(event) => setSellerPhoneNumber(event.target.value)}
                        className="mt-1 w-full rounded-xl border border-[#E5E7EB] bg-white px-3 py-2 text-sm text-[#1A1A1A] outline-none transition focus:border-[#0066FF] focus:ring-2 focus:ring-[#4D9FFF]/40"
                        placeholder="+63 987 654 3210"
                        required
                      />
                      <p className="mt-1 text-xs text-[#666666]">
                        Enter the seller's GCash number. Only the seller with this phone number can connect to this transaction.
                      </p>
                    </label>
                    <label className="text-sm font-medium text-[#333333]">
                      Protection Window Expiry Date
                      <div className="mt-1 flex items-center gap-2">
                        <input
                          type="date"
                          value={protectionWindowDate}
                          onChange={(event) => setProtectionWindowDate(event.target.value)}
                          min={new Date().toISOString().split('T')[0]}
                          className="flex-1 rounded-xl border border-[#E5E7EB] bg-white px-3 py-2 text-sm text-[#1A1A1A] outline-none transition focus:border-[#0066FF] focus:ring-2 focus:ring-[#4D9FFF]/40"
                          required
                        />
                        {protectionWindowDate && (() => {
                          const today = new Date()
                          today.setHours(0, 0, 0, 0)
                          const selectedDate = new Date(protectionWindowDate)
                          selectedDate.setHours(0, 0, 0, 0)
                          const diffTime = selectedDate.getTime() - today.getTime()
                          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
                          return diffDays >= 0 ? (
                            <span className="text-sm font-medium text-[#666666] whitespace-nowrap">
                              ({diffDays} {diffDays === 1 ? 'day' : 'days'})
                            </span>
                          ) : null
                        })()}
                      </div>
                    </label>
                    <p className="text-xs text-[#666666]">
                      After the protection window expires, funds will be returned to buyer and seller's hold amount will be deducted.
                    </p>
                    <label className="text-sm font-medium text-[#333333]">
                      Transaction Description
                      <input
                        type="text"
                        value={transactionDescription}
                        onChange={(event) => setTransactionDescription(event.target.value)}
                        className="mt-1 w-full rounded-xl border border-[#E5E7EB] bg-white px-3 py-2 text-sm text-[#1A1A1A] outline-none transition focus:border-[#0066FF] focus:ring-2 focus:ring-[#4D9FFF]/40"
                        placeholder="Enter a description for this transaction"
                        required
                      />
                      <p className="mt-1 text-xs text-[#666666]">
                        Add a short description to help identify this transaction.
                      </p>
                    </label>
                   
                    <div className="mt-4 rounded-xl border border-[#E5E7EB] bg-[#F9FAFB] p-3">
                      <label className="flex items-start gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={buyerTermsAccepted}
                          onChange={(e) => setBuyerTermsAccepted(e.target.checked)}
                          className="mt-0.5 h-4 w-4 rounded border-[#E5E7EB] text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-xs text-[#666666] leading-relaxed">
                          I acknowledge that when the seller approves the transaction request, 
                          a <span className="font-semibold text-[#1A1A1A]">₱100 transaction fee</span> will be deducted from my wallet.
                        </span>
                      </label>
                    </div>
                    <button
                      type="button"
                      onClick={handleCreateTransaction}
                      disabled={!buyerTermsAccepted}
                      className="mt-4 rounded-xl bg-[#0066FF] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#0052CC] disabled:bg-gray-300 disabled:cursor-not-allowed disabled:text-gray-500"
                    >
                       Send Transaction Request
                    </button>
                  </div>
                </div>
              )}

              {inviteLink && invitePayload && !sellerConnected && (
                <div className="rounded-2xl border border-[#F59E0B] bg-[#FEF3C7] p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-[#F59E0B]"></div>
                    <h4 className="text-base font-semibold text-[#92400E]">Transaction Request Pending</h4>
                  </div>
                  <div className="rounded-xl bg-white p-3">
                    <p className="text-xs text-[#333333]">Transaction ID</p>
                    <p className="text-base font-semibold text-[#1A1A1A]">{invitePayload.buyerId}</p>
                    <div className="mt-2 border-t border-[#E5E7EB] pt-2">
                      <p className="text-xs text-[#333333]">Amount</p>
                      <p
                        className="text-xl font-bold text-[#1A1A1A]"
                        style={{ fontFamily: '"Gotham Rounded", "Karla", sans-serif' }}
                      >
                        ₱{invitePayload.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                    {invitePayload.description && (
                      <div className="mt-2 border-t border-[#E5E7EB] pt-2">
                        <p className="text-xs text-[#333333]">Description</p>
                        <p className="text-sm font-medium text-[#1A1A1A]">{invitePayload.description}</p>
                      </div>
                    )}
                    <div className="mt-2 border-t border-[#E5E7EB] pt-2">
                      <p className="text-xs text-[#333333]">Seller GCash Number</p>
                      <p className="text-sm font-medium text-[#1A1A1A]">{invitePayload.sellerPhoneNumber}</p>
                    </div>
                  </div>
                  <div className="mt-3">
                    <p className="text-xs text-[#92400E]">
                      Waiting for seller to approve the transaction request...
                    </p>
                  </div>
                </div>
              )}

              {activeTransaction && sellerConnected && !amountHeldInEscrow && (
                <div className="rounded-2xl border border-[#F59E0B] bg-[#FEF3C7] p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-[#F59E0B]"></div>
                    <h4 className="text-base font-semibold text-[#92400E]">Seller Connected</h4>
                  </div>
                  <div className="rounded-xl bg-white p-3">
                    <p className="text-xs text-[#333333]">Transaction ID</p>
                    <p className="text-base font-semibold text-[#1A1A1A]">{activeTransaction.buyerId}</p>
                    {activeTransaction.description && (
                      <div className="mt-2 border-t border-[#E5E7EB] pt-2">
                        <p className="text-xs text-[#333333]">Description</p>
                        <p className="text-sm font-medium text-[#1A1A1A]">{activeTransaction.description}</p>
                      </div>
                    )}
                    <p className="mt-2 text-xs text-[#333333]">Transaction Amount</p>
                    <p
                      className="text-xl font-bold text-[#1A1A1A]"
                      style={{ fontFamily: '"Gotham Rounded", "Karla", sans-serif' }}
                    >
                      ₱{activeTransaction.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </p>
                    <p className="mt-2 text-xs text-[#333333]">Transaction Fee</p>
                    <p
                      className="text-lg font-semibold text-[#1A1A1A]"
                      style={{ fontFamily: '"Gotham Rounded", "Karla", sans-serif' }}
                    >
                      ₱{TRANSACTION_FEE.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </p>
                    <div className="mt-2 border-t border-[#E5E7EB] pt-2">
                      <p className="text-xs text-[#333333]">Total Amount</p>
                      <p
                        className="text-xl font-bold text-[#1A1A1A]"
                        style={{ fontFamily: '"Gotham Rounded", "Karla", sans-serif' }}
                      >
                        ₱{(activeTransaction.amount + TRANSACTION_FEE).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                  </div>
                  <div className="mt-4">
                    <p className="mb-2 text-xs text-[#92400E]">
                      Seller has connected. Send money to escrow wallet to proceed.
                    </p>
                    <button
                      type="button"
                      onClick={handleSendMoneyToEscrow}
                      disabled={(activeTransaction.amount + TRANSACTION_FEE) > balance}
                      className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                        (activeTransaction.amount + TRANSACTION_FEE) > balance
                          ? 'bg-[#9CA3AF] text-white cursor-not-allowed'
                          : 'bg-[#F59E0B] text-white hover:bg-[#D97706]'
                      }`}
                    >
                      Send Money to Escrow Wallet
                    </button>
                    {(activeTransaction.amount + TRANSACTION_FEE) > balance && (
                      <p className="mt-2 text-xs text-[#92400E]">
                        Insufficient balance. You need ₱{(activeTransaction.amount + TRANSACTION_FEE).toLocaleString(undefined, { minimumFractionDigits: 2 })} (amount + transaction fee).
                      </p>
                    )}
                  </div>
                </div>
              )}

              {activeTransaction && amountHeldInEscrow && (
                <div className="rounded-2xl border border-[#10B981] bg-[#D1FAE5] p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-[#10B981]"></div>
                    <h4 className="text-base font-semibold text-[#065F46]">Transaction Details</h4>
                  </div>
                  <div className="rounded-xl bg-white p-3">
                    <p className="text-xs text-[#333333]">Transaction ID</p>
                    <p className="text-base font-semibold text-[#1A1A1A]">{activeTransaction.buyerId}</p>
                    {activeTransaction.description && (
                      <div className="mt-2 border-t border-[#E5E7EB] pt-2">
                        <p className="text-xs text-[#333333]">Description</p>
                        <p className="text-sm font-medium text-[#1A1A1A]">{activeTransaction.description}</p>
                      </div>
                    )}
                    <p className="mt-2 text-xs text-[#333333]">Amount sent</p>
                    <p
                      className="text-xl font-bold text-[#1A1A1A]"
                      style={{ fontFamily: '"Gotham Rounded", "Karla", sans-serif' }}
                    >
                      ₱{activeTransaction.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </p>
                    {getProtectionWindowTimeRemaining(activeTransaction) && !transferCompleted && (
                      <>
                        <p className="mt-2 text-xs text-[#333333]">Protection Window</p>
                        <p
                          className={`text-lg font-semibold ${
                            activeTransaction.expired ? 'text-[#EF4444]' : 'text-[#F59E0B]'
                          }`}
                          style={{ fontFamily: '"Gotham Rounded", "Karla", sans-serif' }}
                        >
                          {getProtectionWindowTimeRemaining(activeTransaction)}
                        </p>
                      </>
                    )}
                  </div>
                  
                  {activeTransaction.expired && !transferCompleted && (
                    <div className="mt-3 rounded-xl bg-[#EF4444] border border-[#DC2626] p-3">
                      <p className="text-sm font-semibold text-white">
                        ✗ Protection Window Expired - Funds Refunded
                      </p>
                      <p className="mt-1 text-xs text-white/90">
                        ₱{activeTransaction.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })} and transaction fee of ₱{TRANSACTION_FEE.toLocaleString(undefined, { minimumFractionDigits: 2 })} have been returned to your wallet.
                      </p>
                    </div>
                  )}
                  
                  {!transferCompleted && !activeTransaction.expired && (
                    <div className="mt-4">
                      <p className="mb-2 text-xs text-[#065F46]">
                        {buyerConfirmed 
                          ? '✓ You have confirmed the transaction. Waiting for seller to confirm...' 
                          : 'Please confirm the transaction first (seller will confirm after you)'}
                      </p>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleBuyerConfirm}
                          disabled={buyerConfirmed || transferCompleted}
                          className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                            buyerConfirmed
                              ? 'bg-[#10B981] text-white cursor-not-allowed'
                              : 'bg-[#0066FF] text-white hover:bg-[#0052CC]'
                          }`}
                        >
                          {buyerConfirmed ? '✓ Confirmed' : 'Confirm Transaction'}
                        </button>
                        {sellerConfirmed && (
                          <span className="text-xs text-[#065F46]">✓ Seller confirmed</span>
                        )}
                      </div>
                    </div>
                  )}

                  {transferCompleted && (
                    <div className="mt-4 rounded-xl bg-[#10B981] p-3">
                      <p className="text-sm font-semibold text-white">
                        ✓ Transfer Completed
                      </p>
                      <p className="mt-1 text-xs text-white/90">
                        Amount has been transferred to the seller.
                      </p>
                    </div>
                  )}

                  {/* Extension Request Section - Buyer */}
                  {!transferCompleted && !activeTransaction.expired && activeTransaction.extensionRequested && (
                    <div className="mt-4 rounded-2xl border border-[#0066FF] bg-[#E6F0FF] p-4">
                      <div className="mb-3 flex items-center gap-2">
                        <div className="h-3 w-3 rounded-full bg-[#0066FF]"></div>
                        <h4 className="text-base font-semibold text-[#0066FF]">Extension Request</h4>
                      </div>
                      <div className="rounded-xl bg-white p-3 mb-3">
                        <p className="text-xs text-[#333333]">Seller Requested Extension</p>
                        <p className="text-sm font-semibold text-[#1A1A1A]">
                          {(() => {
                            const extDate = getExtensionRequestDate()
                            return extDate ? new Date(extDate).toLocaleDateString() : `${activeTransaction.extensionRequestDays || 0}d ${activeTransaction.extensionRequestHours || 0}h`
                          })()}
                        </p>
                        {activeTransaction.extensionApproved && (
                          <p className="mt-2 text-xs text-[#10B981] font-semibold">
                            ✓ Extension approved: {activeTransaction.extensionApprovedDays || 0}d {activeTransaction.extensionApprovedHours || 0}h
                          </p>
                        )}
                      </div>
                      {!activeTransaction.extensionApproved && (
                        <div className="space-y-3">
                          <p className="text-xs text-[#0066FF]">
                            Review and confirm the seller's extension request:
                          </p>
                          <button
                            type="button"
                            onClick={handleBuyerApproveExtension}
                            className="w-full rounded-xl bg-[#0066FF] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#0052CC]"
                          >
                            Approve Extension
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              
            </section>

            {/* Seller Section */}
            <section className="relative flex w-full h-full flex-col gap-4 rounded-[32px] border-[3px] border-black bg-white/95 px-5 py-6 shadow-[0_20px_48px_rgba(15,23,42,0.08)]">
              <span className="pointer-events-none absolute left-1/2 top-0 h-6 w-32 -translate-x-1/2 transform rounded-b-3xl bg-[#1A1A1A]/90" />
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#666666]">Seller</p>
                 
                </div>
                <span className="rounded-full bg-[#E6F0FF] px-3 py-1 text-xs font-semibold text-[#0066FF]">Device B</span>
              </div>

              {/* Current Wallet Value and Phone Number */}
              <div className="rounded-2xl border border-[#E5E7EB] bg-gradient-to-r from-[#F0F7FF] to-[#E6F0FF] p-4">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <p className="text-xs font-medium text-[#666666]">Wallet Balance</p>
                    <p
                      key={`seller-balance-${sellerWalletBalance}`}
                      className="text-xl font-bold text-[#1A1A1A]"
                      style={{ fontFamily: '"Gotham Rounded", "Karla", sans-serif' }}
                    >
                      ₱{formattedSellerBalance}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-[#666666]">Phone Number</p>
                    <p className="text-lg font-semibold text-[#1A1A1A]">
                      {mockSellerPhoneNumber}
                    </p>
                  </div>
                </div>
              </div>

              {!connected && (
                <>
                  {/* Pending Transactions */}
                  {pendingTransactions.length > 0 ? (
                    <div className="rounded-2xl border border-[#E5E7EB] bg-white/95 p-4">
                      <div className="mb-3">
                        <h3 className="text-lg font-semibold text-[#1A1A1A]">Pending Transactions</h3>
                        <p className="text-xs text-[#666666]">
                          You have {pendingTransactions.length} transaction{pendingTransactions.length !== 1 ? 's' : ''} waiting for your approval.
                        </p>
                      </div>
                      <div className="flex flex-col gap-3">
                        {pendingTransactions.map((transaction) => (
                          <div
                            key={transaction.buyerId}
                            className="rounded-xl border border-[#E5E7EB] bg-white p-4"
                          >
                            <div className="mb-3">
                              <p className="text-sm font-semibold text-blue-600 mb-1">Pending transaction</p>
                              <p className="text-xs font-medium text-[#666666]">Transaction ID</p>
                              <p className="text-sm font-semibold text-[#1A1A1A]">{transaction.buyerId}</p>
                            </div>
                            <div className="mb-3">
                              <p className="text-xs font-medium text-[#666666]">Amount</p>
                              <p
                                className="text-lg font-bold text-[#1A1A1A]"
                                style={{ fontFamily: '"Gotham Rounded", "Karla", sans-serif' }}
                              >
                                ₱{transaction.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                              </p>
                            </div>
                            {transaction.description && (
                              <div className="mb-3">
                                <p className="text-xs font-medium text-[#666666]">Description</p>
                                <p className="text-sm text-[#1A1A1A]">{transaction.description}</p>
                              </div>
                            )}
                            <div className="mb-3">
                              <p className="text-xs font-medium text-[#666666]">Buyer's GCash Number</p>
                              <p className="text-sm text-[#1A1A1A]">{transaction.buyerPhoneNumber || 'N/A'}</p>
                            </div>
                            <div className="mb-3 border-t border-[#E5E7EB] pt-3">
                              <label className="flex items-start gap-2 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={termsAccepted[transaction.buyerId] || false}
                                  onChange={(e) => {
                                    setTermsAccepted(prev => ({
                                      ...prev,
                                      [transaction.buyerId]: e.target.checked
                                    }))
                                  }}
                                  className="mt-0.5 h-4 w-4 rounded border-[#E5E7EB] text-blue-600 focus:ring-blue-500"
                                />
                                <span className="text-xs text-[#666666]">
                                  I agree to the terms and conditions of this escrow transaction. By checking this checkbox, I acknowledge that <span className="font-semibold text-[#1A1A1A]">₱100 will be placed on hold</span> from my wallet.
                                </span>
                              </label>
                            </div>
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => handleSellerReject(transaction)}
                                className="flex-1 rounded-xl bg-white border-2 border-blue-600 px-4 py-2 text-sm font-semibold text-blue-600 transition hover:bg-blue-50"
                              >
                                Reject
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSellerApprove(transaction)}
                                disabled={!termsAccepted[transaction.buyerId]}
                                className="flex-1 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed disabled:text-gray-500"
                              >
                                Approve
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-[#E5E7EB] bg-white/95 p-4">
                      <div className="mb-3">
                        <h3 className="text-lg font-semibold text-[#1A1A1A]">Pending Transactions</h3>
                        <p className="text-xs text-[#666666]">
                          No pending transactions. Transactions will appear here automatically when buyers create them with your GCash number.
                        </p>
                      </div>
                    </div>
                  )}
                </>
              )}

              {connected && activeTransaction && amountHeldInEscrow && (
                <div className="rounded-2xl border border-[#10B981] bg-[#D1FAE5] p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-[#10B981]"></div>
                    <h4 className="text-base font-semibold text-[#065F46]">Transaction Details</h4>
                  </div>
                  <div className="rounded-xl bg-white p-3">
                    <p className="text-xs text-[#333333]">Transaction ID</p>
                    <p className="text-base font-semibold text-[#1A1A1A]">{activeTransaction.buyerId}</p>
                    {activeTransaction.description && (
                      <div className="mt-2 border-t border-[#E5E7EB] pt-2">
                        <p className="text-xs text-[#333333]">Description</p>
                        <p className="text-sm font-medium text-[#1A1A1A]">{activeTransaction.description}</p>
                      </div>
                    )}
                    <p className="mt-2 text-xs text-[#333333]">Amount received</p>
                    <p
                      className="text-xl font-bold text-[#1A1A1A]"
                      style={{ fontFamily: '"Gotham Rounded", "Karla", sans-serif' }}
                    >
                      ₱{(activeTransaction.amount + SELLER_HOLD_AMOUNT).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </p>
                    {getProtectionWindowTimeRemaining(activeTransaction) && !transferCompleted && (
                      <>
                        <p className="mt-2 text-xs text-[#333333]">Protection Window</p>
                        <p
                          className={`text-lg font-semibold ${
                            activeTransaction.expired ? 'text-[#EF4444]' : 'text-[#F59E0B]'
                          }`}
                          style={{ fontFamily: '"Gotham Rounded", "Karla", sans-serif' }}
                        >
                          {getProtectionWindowTimeRemaining(activeTransaction)}
                        </p>
                      </>
                    )}
                  </div>
                  
                  {activeTransaction.expired && !transferCompleted && (
                    <div className="mt-3 rounded-xl bg-[#EF4444] border border-[#DC2626] p-3">
                      <p className="text-sm font-semibold text-white">
                        ✗ Transaction Failed - Protection Window Expired
                      </p>
                      <p className="mt-1 text-xs text-white/90">
                        ₱{SELLER_HOLD_AMOUNT.toLocaleString(undefined, { minimumFractionDigits: 2 })} hold amount has been deducted from your wallet.
                      </p>
                    </div>
                  )}
                  
                  {!transferCompleted && !activeTransaction.expired && (
                    <div className="mt-4">
                      <p className="mb-2 text-xs text-[#065F46]">
                        {!buyerConfirmed 
                          ? 'Waiting for buyer to confirm first...'
                          : sellerConfirmed 
                          ? '✓ You have confirmed the transaction' 
                          : 'Buyer has confirmed. Please confirm the transaction to proceed'}
                      </p>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleSellerConfirm}
                          disabled={!buyerConfirmed || sellerConfirmed || transferCompleted}
                          className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                            !buyerConfirmed
                              ? 'bg-[#9CA3AF] text-white cursor-not-allowed'
                              : sellerConfirmed
                              ? 'bg-[#10B981] text-white cursor-not-allowed'
                              : 'bg-[#0066FF] text-white hover:bg-[#0052CC]'
                          }`}
                        >
                          {!buyerConfirmed 
                            ? 'Waiting for Buyer...'
                            : sellerConfirmed 
                            ? '✓ Confirmed' 
                            : 'Confirm Transaction'}
                        </button>
                        {buyerConfirmed && (
                          <span className="text-xs text-[#065F46]">✓ Buyer confirmed</span>
                        )}
                      </div>
                    </div>
                  )}

                  {transferCompleted && (
                    <div className="mt-4 rounded-xl bg-[#10B981] p-3">
                      <p className="text-sm font-semibold text-white">
                        ✓ Transfer Completed
                      </p>
                      <p className="mt-1 text-xs text-white/90">
                        Amount has been transferred to you. ₱{SELLER_HOLD_AMOUNT.toLocaleString(undefined, { minimumFractionDigits: 2 })} hold has been released.
                      </p>
                    </div>
                  )}

                  {/* Extension Request Button - Seller */}
                  {!transferCompleted && !activeTransaction.expired && buyerConfirmed && (
                    <div className="mt-4">
                      <button
                        type="button"
                        onClick={() => setShowExtensionModal(true)}
                        className="w-full rounded-xl border border-[#0066FF] bg-[#E6F0FF] px-4 py-3 text-sm font-semibold text-[#0066FF] transition hover:bg-[#D1E7FF]"
                      >
                        {activeTransaction.extensionRequested ? (
                          activeTransaction.extensionApproved ? (
                            `✓ Extension Approved: ${activeTransaction.extensionApprovedDays || 0}d ${activeTransaction.extensionApprovedHours || 0}h`
                          ) : (
                            `⏳ Extension Pending: ${activeTransaction.extensionRequestDays || 0}d ${activeTransaction.extensionRequestHours || 0}h`
                          )
                        ) : (
                          'Request Extension'
                        )}
                      </button>
                    </div>
                  )}

                  {/* Extension Request Modal - Only show on seller device */}
                  {showExtensionModal && (
                    <div 
                      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
                      onClick={() => setShowExtensionModal(false)}
                    >
                      <div 
                        className="w-full max-w-md rounded-2xl border border-[#E5E7EB] bg-white p-6 shadow-xl"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="mb-4 flex items-center justify-between">
                          <h3 className="text-xl font-semibold text-[#1A1A1A]">Request Extension</h3>
                          <button
                            onClick={() => setShowExtensionModal(false)}
                            className="rounded-lg p-1 text-[#666666] transition hover:bg-[#F9FAFB]"
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              className="h-5 w-5"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth={2}
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M6 18L18 6M6 6l12 12"
                              />
                            </svg>
                          </button>
                        </div>

                        {activeTransaction.extensionRequested && (
                          <div className="mb-4 rounded-xl bg-[#FEF3C7] border border-[#F59E0B]/30 p-3">
                            <p className="text-xs font-medium text-[#92400E]">Extension Request Status</p>
                            {activeTransaction.extensionApproved ? (
                              <p className="text-sm font-semibold text-[#10B981] mt-1">
                                ✓ Approved: {activeTransaction.extensionApprovedDays || 0}d {activeTransaction.extensionApprovedHours || 0}h
                              </p>
                            ) : (
                              <p className="text-sm font-semibold text-[#F59E0B] mt-1">
                                ⏳ Pending: {(() => {
                                  const extDate = getExtensionRequestDate()
                                  return extDate ? `Until ${new Date(extDate).toLocaleDateString()}` : `${activeTransaction.extensionRequestDays || 0}d ${activeTransaction.extensionRequestHours || 0}h`
                                })()}
                              </p>
                            )}
                          </div>
                        )}

                        {(!activeTransaction.extensionRequested || activeTransaction.extensionApproved) && (
                          <div className="space-y-4">
                            <p className="text-sm text-[#666666]">
                              Request to extend the protection window to a new expiry date:
                            </p>
                            <label className="text-sm font-medium text-[#333333]">
                              New Protection Window Expiry Date
                              <input
                                type="date"
                                value={extensionRequestDate}
                                onChange={(event) => setExtensionRequestDate(event.target.value)}
                                min={getMinExtensionDate()}
                                className="mt-1 w-full rounded-xl border border-[#E5E7EB] bg-white px-3 py-2 text-sm text-[#1A1A1A] outline-none transition focus:border-[#0066FF] focus:ring-2 focus:ring-[#4D9FFF]/40"
                              />
                              <p className="mt-1 text-xs text-[#666666]">
                                Select a date after the current protection window expiry date.
                              </p>
                            </label>
                            <div className="flex gap-3">
                              <button
                                type="button"
                                onClick={() => setShowExtensionModal(false)}
                                className="flex-1 rounded-xl border border-[#E5E7EB] bg-white px-4 py-2 text-sm font-semibold text-[#333333] transition hover:bg-[#F9FAFB]"
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                onClick={handleSellerRequestExtension}
                                disabled={activeTransaction.extensionRequested && !activeTransaction.extensionApproved}
                                className={`flex-1 rounded-xl px-4 py-2 text-sm font-semibold text-white transition ${
                                  activeTransaction.extensionRequested && !activeTransaction.extensionApproved
                                    ? 'bg-[#9CA3AF] cursor-not-allowed'
                                    : 'bg-[#0066FF] hover:bg-[#0052CC]'
                                }`}
                              >
                                {activeTransaction.extensionRequested && !activeTransaction.extensionApproved
                                  ? 'Request Pending'
                                  : 'Request Extension'}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {connected && activeTransaction && !amountHeldInEscrow && (
                <div className="rounded-2xl border border-[#F59E0B] bg-[#FEF3C7] p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-[#F59E0B]"></div>
                    <h4 className="text-base font-semibold text-[#92400E]">Connected</h4>
                  </div>
                  <div className="rounded-xl bg-white p-3">
                    <p className="text-xs text-[#333333]">Transaction ID</p>
                    <p className="text-base font-semibold text-[#1A1A1A]">{activeTransaction.buyerId}</p>
                    {activeTransaction.description && (
                      <div className="mt-2 border-t border-[#E5E7EB] pt-2">
                        <p className="text-xs text-[#333333]">Description</p>
                        <p className="text-sm font-medium text-[#1A1A1A]">{activeTransaction.description}</p>
                      </div>
                    )}
                    <p className="mt-2 text-xs text-[#333333]">Transaction Amount</p>
                    <p
                      className="text-xl font-bold text-[#1A1A1A]"
                      style={{ fontFamily: '"Gotham Rounded", "Karla", sans-serif' }}
                    >
                      ₱{activeTransaction.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </p>
                    {sellerAmountOnHold && (
                      <>
                        <p className="mt-2 text-xs text-[#333333]">Amount On Hold (will be released after completion)</p>
                        <p
                          className="text-lg font-semibold text-[#F59E0B]"
                          style={{ fontFamily: '"Gotham Rounded", "Karla", sans-serif' }}
                        >
                          ₱{SELLER_HOLD_AMOUNT.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </p>
                      </>
                    )}
                  </div>
                  <p className="mt-3 text-xs text-[#92400E]">
                    ✓ Connection established. Waiting for buyer to send money to escrow wallet...
                  </p>
                </div>
              )}

              
            </section>
          </div>
        </main>
      </div>

      {/* Add Funds Modal */}
      {showAddFundsModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setShowAddFundsModal(false)}
        >
          <div 
            className="w-full max-w-md rounded-2xl border border-[#E5E7EB] bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#10B981] to-[#059669] shadow-md">
                  <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 6v6m0 0v6m0-6h6m-6 0H6"/>
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-[#1A1A1A]">Add Funds</h3>
              </div>
              <button
                onClick={() => setShowAddFundsModal(false)}
                className="rounded-lg p-1 text-[#666666] transition hover:bg-[#F9FAFB]"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              {/* Buyer Wallet Section */}
              <div className="rounded-xl border-2 border-blue-200 bg-blue-50/50 p-4">
                <div className="mb-3 flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100">
                    <svg className="h-5 w-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
                    </svg>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-bold text-blue-700">Buyer Wallet</p>
                    <p className="text-xs text-gray-600">
                      Current: ₱{buyerWalletBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={addFundsBuyerAmount}
                    onChange={(e) => setAddFundsBuyerAmount(e.target.value)}
                    placeholder="Enter amount"
                    className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                    step="0.01"
                    min="0"
                  />
                  <button
                    onClick={handleAddFundsToBuyer}
                    disabled={!addFundsBuyerAmount || parseFloat(addFundsBuyerAmount) <= 0}
                    className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors shadow-sm"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6"/>
                    </svg>
                    Add
                  </button>
                </div>
              </div>

              {/* Seller Wallet Section */}
              <div className="rounded-xl border-2 border-green-200 bg-green-50/50 p-4">
                <div className="mb-3 flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-100">
                    <svg className="h-5 w-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"/>
                    </svg>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-bold text-green-700">Seller Wallet</p>
                    <p className="text-xs text-gray-600">
                      Current: ₱{sellerWalletBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={addFundsSellerAmount}
                    onChange={(e) => setAddFundsSellerAmount(e.target.value)}
                    placeholder="Enter amount"
                    className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/20"
                    step="0.01"
                    min="0"
                  />
                  <button
                    onClick={handleAddFundsToSeller}
                    disabled={!addFundsSellerAmount || parseFloat(addFundsSellerAmount) <= 0}
                    className="flex items-center gap-1.5 rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors shadow-sm"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6"/>
                    </svg>
                    Add
                  </button>
                </div>
              </div>

              {/* Info */}
              <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 p-3">
                <svg className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd"/>
                </svg>
                <p className="text-xs text-amber-800">
                  <span className="font-semibold">Development only:</span> Add funds to buyer or seller wallets for testing. Changes are saved to localStorage.
                </p>
              </div>

              {/* Close Button */}
              <button
                onClick={() => setShowAddFundsModal(false)}
                className="w-full rounded-xl border border-[#E5E7EB] bg-white px-4 py-2.5 text-sm font-semibold text-[#333333] transition hover:bg-[#F9FAFB]"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

