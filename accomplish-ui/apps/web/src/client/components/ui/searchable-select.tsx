import { useState, useRef, useEffect, useId, useCallback, useLayoutEffect } from 'react';
import { AnimatePresence } from 'framer-motion';
import {
  SelectTrigger,
  SelectDropdown,
  SelectError,
  SelectLoading,
  type DropdownPosition,
} from './searchable-select-parts';

export type { SelectItem } from './searchable-select-parts';

interface SearchableSelectProps {
  items: import('./searchable-select-parts').SelectItem[];
  value: string | null;
  onChange: (id: string) => void;
  label: string;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  loading?: boolean;
  loadingMessage?: string;
  error?: boolean;
  errorMessage?: string;
  testId?: string;
}

export function SearchableSelect({
  items,
  value,
  onChange,
  label,
  placeholder = 'Select...',
  searchPlaceholder = 'Search...',
  emptyMessage = 'No items found',
  loading,
  loadingMessage,
  error,
  errorMessage,
  testId,
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [position, setPosition] = useState<DropdownPosition | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const instanceId = useId();

  // Compute the dropdown position from the trigger's viewport rect so it can be
  // portaled to <body> and escape any clipping `overflow` ancestor (e.g. the
  // scrollable settings dialog). Flips upward when there isn't room below.
  const updatePosition = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUp = spaceBelow < 280 && rect.top > spaceBelow;
    setPosition({
      left: rect.left,
      width: rect.width,
      top: openUp ? rect.top : rect.bottom,
      openUp,
    });
  }, []);

  const listboxId = testId ? `${testId}-listbox` : `${instanceId}-listbox`;

  const showSearch = items.length > 10;

  const filteredItems = search
    ? items.filter(
        (item) =>
          item.name.toLowerCase().includes(search.toLowerCase()) ||
          item.id.toLowerCase().includes(search.toLowerCase()),
      )
    : items;

  const selectedItem = items.find((item) => item.id === value);
  const displayValue = selectedItem?.name || '';

  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      const insideTrigger = containerRef.current?.contains(target);
      const insideDropdown = dropdownRef.current?.contains(target);
      if (!insideTrigger && !insideDropdown) {
        setIsOpen(false);
        setSearch('');
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Keep the portaled dropdown aligned with its trigger while open.
  useLayoutEffect(() => {
    if (!isOpen) return;
    updatePosition();
    const onChange = () => updatePosition();
    window.addEventListener('resize', onChange);
    window.addEventListener('scroll', onChange, true); // capture: catch scrolls in any container
    return () => {
      window.removeEventListener('resize', onChange);
      window.removeEventListener('scroll', onChange, true);
    };
  }, [isOpen, updatePosition]);

  useEffect(() => {
    if (isOpen && showSearch && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen, showSearch]);

  if (loading) {
    return <SelectLoading label={label} loadingMessage={loadingMessage} />;
  }

  const handleSelect = (id: string) => {
    onChange(id);
    setIsOpen(false);
    setSearch('');
  };

  return (
    <div ref={containerRef}>
      <label className="mb-2 block text-sm font-medium text-foreground">{label}</label>
      <div className="relative">
        <SelectTrigger
          ref={triggerRef}
          displayValue={displayValue}
          placeholder={placeholder}
          isOpen={isOpen}
          error={error}
          testId={testId}
          onClick={() => {
            if (!isOpen) updatePosition();
            setIsOpen(!isOpen);
          }}
          listboxId={listboxId}
        />
        <AnimatePresence>
          {isOpen && position && (
            <SelectDropdown
              ref={dropdownRef}
              position={position}
              items={filteredItems}
              value={value}
              showSearch={showSearch}
              search={search}
              onSearchChange={setSearch}
              searchPlaceholder={searchPlaceholder}
              emptyMessage={emptyMessage}
              onSelect={handleSelect}
              inputRef={inputRef}
              testId={testId}
              listboxId={listboxId}
            />
          )}
        </AnimatePresence>
      </div>
      {error && errorMessage && <SelectError message={errorMessage} testId={testId} />}
    </div>
  );
}
