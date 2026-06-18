import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { ArrowUpLeft } from '@phosphor-icons/react';
import { springs } from '@/lib/animations';
import { IntegrationIcon } from '@/components/landing/IntegrationIcons';

interface UseCaseExample {
  key: string;
  title: string;
  description: string;
  prompt: string;
  icons: readonly string[];
}

interface ExamplesSectionProps {
  useCaseExamples: UseCaseExample[];
  onExampleClick: (prompt: string) => void;
}

export function ExamplesSection({ useCaseExamples, onExampleClick }: ExamplesSectionProps) {
  const { t } = useTranslation('home');

  return null;
}
