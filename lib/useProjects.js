'use client'

import React from 'react'

// Ported verbatim from designpipe-app/renderer/lib/useProjects.js — the
// ipc shim means this needs zero changes; the stale-closure race guard
// (idRef) from last night's live-caught bug carries over for free.
export function useProjects() {
  const [projects, setProjects] = React.useState([])
  const [loading, setLoading] = React.useState(true)

  const refresh = React.useCallback(async () => {
    setLoading(true)
    const rows = await window.ipc.invoke('projects:list')
    setProjects(rows)
    setLoading(false)
  }, [])

  React.useEffect(() => { refresh() }, [refresh])

  const createProject = React.useCallback(async (name, projectType) => {
    const project = await window.ipc.invoke('projects:create', name, projectType)
    await refresh()
    return project
  }, [refresh])

  const deleteProject = React.useCallback(async (id) => {
    await window.ipc.invoke('projects:delete', id)
    await refresh()
  }, [refresh])

  return { projects, loading, refresh, createProject, deleteProject }
}

export function useActiveProject(id) {
  const [project, setProject] = React.useState(null)
  const [loading, setLoading] = React.useState(!!id)

  const idRef = React.useRef(id)
  idRef.current = id

  React.useEffect(() => {
    if (!id) { setProject(null); return }
    setLoading(true)
    window.ipc.invoke('projects:get', id).then((p) => {
      if (idRef.current !== id) return
      setProject(p)
      setLoading(false)
    })
  }, [id])

  const saveData = React.useCallback(async (data) => {
    if (!id) return
    setProject((prev) => (prev && idRef.current === id ? { ...prev, data } : prev))
    const updated = await window.ipc.invoke('projects:updateData', id, data)
    if (idRef.current !== id) return updated
    setProject(updated)
    return updated
  }, [id])

  const renameProject = React.useCallback(async (name) => {
    if (!id) return
    setProject((prev) => (prev && idRef.current === id ? { ...prev, name } : prev))
    const updated = await window.ipc.invoke('projects:rename', id, name)
    if (idRef.current !== id) return updated
    setProject(updated)
    return updated
  }, [id])

  return { project, loading, saveData, renameProject }
}
