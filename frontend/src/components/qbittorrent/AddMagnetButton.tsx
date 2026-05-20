import { useState, useRef, useEffect } from 'react'
import { Download, ChevronDown } from 'lucide-react'
import { useAddMagnet } from '../../api/qbittorrent'
import { useAddMagnetToClient, useDownloadClients } from '../../api/downloadClients'

interface AddMagnetButtonProps {
  magnetUri: string
  size?: 'sm' | 'md'
}

export default function AddMagnetButton({ magnetUri, size = 'sm' }: AddMagnetButtonProps) {
  const [showDropdown, setShowDropdown] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const defaultMutation = useAddMagnet()
  const clientMutation = useAddMagnetToClient()
  const { data: clients } = useDownloadClients()

  const enabledClients = clients?.filter(c => c.is_enabled) || []
  const hasMultiple = enabledClients.length > 1

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false)
      }
    }
    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showDropdown])

  const handleSendDefault = () => {
    defaultMutation.mutate({ magnet_uri: magnetUri })
  }

  const handleSendToClient = (clientId: number) => {
    clientMutation.mutate({ client_id: clientId, magnet_uri: magnetUri })
    setShowDropdown(false)
  }

  const isPending = defaultMutation.isPending || clientMutation.isPending
  const btnSize = size === 'sm' ? 'px-2 py-1 text-xs' : 'px-3 py-1.5 text-sm'

  return (
    <div className="relative inline-flex" ref={dropdownRef}>
      <button
        onClick={handleSendDefault}
        disabled={isPending}
        className={`${btnSize} rounded-l bg-[var(--green)] text-white hover:opacity-80 disabled:opacity-50 transition-opacity flex items-center gap-1`}
      >
        <Download className="w-3 h-3" />
        {isPending ? 'Adding...' : 'Send'}
      </button>
      {hasMultiple && (
        <>
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            disabled={isPending}
            className={`px-1.5 rounded-r bg-[var(--green)] text-white hover:opacity-80 disabled:opacity-50 transition-opacity border-l border-white/20 flex items-center`}
          >
            <ChevronDown className="w-3 h-3" />
          </button>
          {showDropdown && (
            <div className="absolute right-0 top-full mt-1 w-56 bg-[var(--bg-card)] border border-[var(--border)] rounded-lg shadow-lg z-50 py-1">
              <div className="px-3 py-1.5 text-xs text-[var(--text-secondary)] border-b border-[var(--border)]">
                Send to client
              </div>
              {enabledClients.map(client => (
                <button
                  key={client.id}
                  onClick={() => handleSendToClient(client.id)}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-[var(--bg-primary)] transition-colors flex items-center justify-between"
                >
                  <span>{client.name}</span>
                  {client.is_default && (
                    <span className="text-[10px] text-[var(--accent)] bg-[var(--accent)]/10 px-1.5 py-0.5 rounded">
                      Default
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
