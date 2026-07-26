import {screen} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {describe, expect, it} from 'vitest'
import {TopToolbar} from './top-toolbar'
import {useDisplayStore} from '../../stores/display-store'
import {makeProject, renderWithRouter} from '../../test/test-utils'

describe('TopToolbar', () => {
  it('changes face and saves the current project', async () => {
    const user = userEvent.setup()

    const baseProject = makeProject({id: 'proj-topbar', tierCount: 4, palletType: 'full'})
    const editedProject = {...baseProject, name: 'Edited Project'}
    useDisplayStore.setState({
      currentProject: editedProject,
      activeFace: 'front',
      history: [baseProject, editedProject],
      historyIndex: 1,
    })

    renderWithRouter(<TopToolbar />)

    expect(screen.getByRole('button', {name: 'Redo'})).toBeDisabled()
    expect(screen.getByRole('button', {name: 'Undo'})).not.toBeDisabled()

    await user.click(screen.getByRole('button', {name: /Front Wall/i}))
    await user.click(screen.getByRole('button', {name: /Right Wall/i}))
    expect(useDisplayStore.getState().activeFace).toBe('right')

    await user.click(screen.getByRole('button', {name: 'Undo'}))
    expect(useDisplayStore.getState().historyIndex).toBe(0)

    await user.click(screen.getByRole('button', {name: 'Save'}))
    expect(localStorage.getItem('palletforge-project')).toContain('Test Project')
    expect(screen.getByRole('button', {name: 'Saved!'})).toBeInTheDocument()
  })

  it('locks half pallets to the front face label', () => {
    useDisplayStore.setState({
      currentProject: makeProject({palletType: 'half'}),
      activeFace: 'front',
      history: [],
      historyIndex: -1,
    })

    renderWithRouter(<TopToolbar />)

    expect(screen.getByText('Front Face')).toBeInTheDocument()
    expect(screen.queryByRole('button', {name: /Front Wall/i})).not.toBeInTheDocument()
  })
})
