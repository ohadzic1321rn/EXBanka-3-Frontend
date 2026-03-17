import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import ClientManagementView from '../../views/ClientManagementView.vue'
import { useClientStore } from '../../stores/client'

vi.mock('../../api/clientManagement', () => ({
  clientManagementApi: {
    list: vi.fn(),
    get: vi.fn(),
    update: vi.fn(),
  },
}))

import { clientManagementApi } from '../../api/clientManagement'

const mockClients = [
  { id: '1', ime: 'Ana', prezime: 'Jović', email: 'ana@gmail.com', brojTelefona: '061', adresa: 'Ulica 1', aktivan: true },
  { id: '2', ime: 'Marko', prezime: 'Petrović', email: 'marko@gmail.com', brojTelefona: '', adresa: '', aktivan: false },
]

describe('ClientManagementView', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    vi.mocked(clientManagementApi.list).mockResolvedValue({
      data: { clients: mockClients, total: '2' },
    })
  })

  it('renders client table with column headers', async () => {
    const wrapper = mount(ClientManagementView)
    await flushPromises()

    expect(wrapper.find('table').exists()).toBe(true)
    expect(wrapper.text()).toContain('Name')
    expect(wrapper.text()).toContain('Email')
    expect(wrapper.text()).toContain('Status')
  })

  it('renders client rows after fetch', async () => {
    const wrapper = mount(ClientManagementView)
    await flushPromises()

    const rows = wrapper.findAll('tbody tr')
    expect(rows).toHaveLength(2)
    expect(wrapper.text()).toContain('Ana Jović')
    expect(wrapper.text()).toContain('Marko Petrović')
  })

  it('renders filter inputs for email and name', async () => {
    const wrapper = mount(ClientManagementView)
    await flushPromises()

    const inputs = wrapper.findAll('input')
    expect(inputs.length).toBeGreaterThanOrEqual(2)
  })

  it('calls fetchClients on mount', async () => {
    mount(ClientManagementView)
    await flushPromises()

    expect(clientManagementApi.list).toHaveBeenCalledTimes(1)
  })

  it('opens edit dialog when Edit button clicked', async () => {
    const detail = { id: '1', ime: 'Ana', prezime: 'Jović', datumRodjenja: '1990-01-01', pol: 'F', email: 'ana@gmail.com', brojTelefona: '061', adresa: 'Ulica 1', aktivan: true }
    vi.mocked(clientManagementApi.get).mockResolvedValueOnce({ data: { client: detail } })

    const wrapper = mount(ClientManagementView)
    await flushPromises()

    const editBtn = wrapper.findAll('button').find(b => b.text() === 'Edit')
    await editBtn!.trigger('click')
    await flushPromises()

    expect(wrapper.find('.modal-overlay').exists()).toBe(true)
    expect(wrapper.text()).toContain('Edit Client')
  })

  it('closes edit dialog when Cancel clicked', async () => {
    const detail = { id: '1', ime: 'Ana', prezime: 'Jović', datumRodjenja: '1990-01-01', pol: 'F', email: 'ana@gmail.com', brojTelefona: '061', adresa: 'Ulica 1', aktivan: true }
    vi.mocked(clientManagementApi.get).mockResolvedValueOnce({ data: { client: detail } })

    const wrapper = mount(ClientManagementView)
    await flushPromises()

    await wrapper.findAll('button').find(b => b.text() === 'Edit')!.trigger('click')
    await flushPromises()
    expect(wrapper.find('.modal-overlay').exists()).toBe(true)

    await wrapper.find('.modal-close').trigger('click')
    expect(wrapper.find('.modal-overlay').exists()).toBe(false)
  })

  it('shows Active/Inactive status badges', async () => {
    const wrapper = mount(ClientManagementView)
    await flushPromises()

    expect(wrapper.text()).toContain('Active')
    expect(wrapper.text()).toContain('Inactive')
  })
})
