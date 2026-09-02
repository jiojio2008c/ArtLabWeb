import { ArrowLeft } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import ConfirmActionDialog from './ConfirmActionDialog.tsx'

type HomeReturnScope = 'dynamic-art' | 'interactive-art'

interface HomeReturnConfirmDialogProps {
  scope: HomeReturnScope
  pending: boolean
  onCancel: () => void
  onConfirm: () => void
}

const HomeReturnConfirmDialog: React.FC<HomeReturnConfirmDialogProps> = ({
  scope,
  pending,
  onCancel,
  onConfirm
}) => {
  const { t } = useTranslation()
  const descriptionKey = scope === 'dynamic-art'
    ? 'homeReturn.dynamicDescription'
    : 'homeReturn.interactiveDescription'

  return (
    <ConfirmActionDialog
      classNamePrefix="home-return-confirm"
      icon={<ArrowLeft />}
      title={t('homeReturn.title')}
      description={t(descriptionKey)}
      cancelLabel={t('homeReturn.stay')}
      confirmLabel={t('homeReturn.confirm')}
      pendingLabel={t('homeReturn.returning')}
      pending={pending}
      autoCloseOnConfirm={false}
      onCancel={onCancel}
      onConfirm={onConfirm}
    />
  )
}

export default HomeReturnConfirmDialog
export type { HomeReturnScope }
