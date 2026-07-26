'use client'

import React from 'react'
import { useAtom, useSetAtom } from 'jotai'
import { AppShell } from '@astryxdesign/core/AppShell'
import { TopNav, TopNavHeading } from '@astryxdesign/core/TopNav'
import { SideNav, SideNavItem, SideNavSection, SideNavCollapseButton } from '@astryxdesign/core/SideNav'
import { IconButton } from '@astryxdesign/core/IconButton'
import { DropdownMenu } from '@astryxdesign/core/DropdownMenu'
import { HStack } from '@astryxdesign/core/HStack'
import { Text } from '@astryxdesign/core/Text'
import { LayoutDashboard, Upload, MessageSquareText, Images, Download, Pencil, LogOut, User, CreditCard } from 'lucide-react'
import GenstockLogo from '../../components/GenstockLogo'
import OverviewSection from '../../components/OverviewSection'
import ProjectSettingsModal from '../../components/ProjectSettingsModal'
import BillingModal from '../../components/BillingModal'
import IntakeSection from '../../components/photos/IntakeSection'
import StorySection from '../../components/story/StorySection'
import CritiqueSection from '../../components/photos/CritiqueSection'
import LightboxSection from '../../components/photos/LightboxSection'
import ExportSection from '../../components/photos/ExportSection'
import { useActiveProject } from '../../lib/useProjects'
import { activeProjectIdAtom, sectionAtom, generationResultsAtom, generationProgressAtom, generationBusyAtom, generationErrorAtom } from '../../lib/atoms'
import { createClient } from '../../lib/supabase/client'

const PHOTOS_SECTIONS = [
  { key: 'intake', label: 'Intake', icon: Upload },
  { key: 'critique', label: 'Critique', icon: MessageSquareText },
  { key: 'lightbox', label: 'Lightbox', icon: Images },
  { key: 'export', label: 'Export', icon: Download },
]

// Simplified port of designpipe-app/renderer/pages/home.jsx — Photos-only
// (no Web pipeline). Real additions matching DesignPipe's actual shell
// pattern: ProjectSettingsModal + pencil-edit next to the title, and the
// SideNav's real footer/footerIcons split (Account footer here, versus
// DesignPipe's Settings footer — same structural slot, different
// content since genstock has no BYOK keys UI, just a real account).
export default function HomeShell({ userEmail }) {
  const [activeProjectId, setActiveProjectId] = useAtom(activeProjectIdAtom)
  const [section, setSection] = useAtom(sectionAtom)

  const { project, loading: projectLoading, saveData, renameProject } = useActiveProject(activeProjectId)
  const [showProjectSettings, setShowProjectSettings] = React.useState(false)
  const [showBilling, setShowBilling] = React.useState(false)

  const setGenResults = useSetAtom(generationResultsAtom)
  const setGenProgress = useSetAtom(generationProgressAtom)
  const setGenBusy = useSetAtom(generationBusyAtom)
  const setGenError = useSetAtom(generationErrorAtom)
  React.useEffect(() => {
    setGenResults([])
    setGenProgress(null)
    setGenBusy(false)
    setGenError(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProjectId])

  const openOverview = () => {
    setActiveProjectId(null)
    setSection('overview')
  }

  const openProject = (p) => {
    setActiveProjectId(p.id)
    setSection('intake')
  }

  const startProject = async (name, projectType) => {
    const created = await window.ipc.invoke('projects:create', name, projectType)
    openProject(created)
    return created
  }

  const signOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  return (
    <React.Fragment>
      <AppShell
        height="fill"
        variant="elevated"
        contentPadding={4}
        topNav={
          <TopNav
            heading={
              <TopNavHeading
                logo={
                  <HStack gap={2} align="center">
                    <GenstockLogo size={40} />
                    <Text type="body" weight="semibold" style={{ fontSize: 20 }}>Web2Ad</Text>
                  </HStack>
                }
              />
            }
            centerContent={
              project ? (
                <HStack gap={2} align="center">
                  <Images size={16} />
                  <Text type="body" weight="semibold">{project.name}</Text>
                  <IconButton
                    label="Edit project"
                    icon={<Pencil size={14} />}
                    variant="ghost"
                    size="sm"
                    tooltip="Project settings"
                    onClick={() => setShowProjectSettings(true)}
                  />
                </HStack>
              ) : null
            }
          />
        }
        sideNav={
          <SideNav
            collapsible={{ hasButton: false }}
            footer={
              <DropdownMenu
                hasChevron={false}
                button={{
                  label: 'Account',
                  icon: <User size={14} />,
                  variant: 'ghost',
                  size: 'sm',
                  style: { width: '100%', justifyContent: 'flex-start', paddingInline: 8 },
                }}
                items={[
                  { type: 'section', title: userEmail, items: [
                    { label: 'Billing', icon: <CreditCard size={14} />, onClick: () => setShowBilling(true) },
                    { label: 'Sign out', icon: <LogOut size={14} />, onClick: signOut },
                  ] },
                ]}
              />
            }
            footerIcons={<SideNavCollapseButton />}
          >
            <SideNavSection title="Web2Ad">
              <SideNavItem label="Overview" icon={LayoutDashboard} isSelected={section === 'overview'} onClick={openOverview} />
            </SideNavSection>
            {project && (
              <SideNavSection title={project.project_type === 'story' ? 'Story' : 'Photos'}>
                {PHOTOS_SECTIONS.map((s) => (
                  <SideNavItem
                    key={s.key}
                    label={s.label}
                    icon={s.icon}
                    isSelected={section === s.key}
                    onClick={() => setSection(s.key)}
                  />
                ))}
              </SideNavSection>
            )}
          </SideNav>
        }
      >
        {section === 'overview' && <OverviewSection onStartProject={startProject} onOpenProject={openProject} />}
        {section !== 'overview' && !project && projectLoading && (
          <HStack gap={2} align="center" style={{ justifyContent: 'center', height: '100%' }}>
            <div className="dp-spinner" style={{ width: 20, height: 20 }} />
            <Text type="body" color="secondary">Loading project…</Text>
          </HStack>
        )}
        {project && section === 'intake' && project.project_type === 'story' && <StorySection key={activeProjectId} project={project} saveData={saveData} />}
        {project && section === 'intake' && project.project_type !== 'story' && <IntakeSection key={activeProjectId} project={project} saveData={saveData} />}
        {project && section === 'critique' && <CritiqueSection key={activeProjectId} project={project} saveData={saveData} />}
        {project && section === 'lightbox' && <LightboxSection key={activeProjectId} project={project} saveData={saveData} />}
        {project && section === 'export' && <ExportSection key={activeProjectId} project={project} />}
      </AppShell>
      {project && (
        <ProjectSettingsModal
          isOpen={showProjectSettings}
          onOpenChange={setShowProjectSettings}
          project={project}
          onRename={renameProject}
        />
      )}
      <BillingModal isOpen={showBilling} onOpenChange={setShowBilling} />
    </React.Fragment>
  )
}
