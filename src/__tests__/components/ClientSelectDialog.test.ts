import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import ClientSelectDialog from '../../components/ClientSelectDialog.vue'
import { clientManagementApi } from '../../api/clientManagement'

vi.mock('../../api/clientManagement', () => ({
  clientManagementApi: {
    list: vi.fn(),
    get: vi.fn(),
    update: vi.fn(),
    create: vi.fn(),
  },
}))

const mockClients = [
  { id: '1', ime: 'Ana', prezime: 'Jović', email: 'ana@gmail.com', brojTelefona: '061', adresa: 'Ulica 1', aktivan: true },
  { id: '2', ime: 'Marko', prezime: 'Petrović', email: 'marko@gmail.com', brojTelefona: '', adresa: '', aktivan: true },
]

describe('ClientSelectDialog', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('renders modal with Search Existing and Create New tabs', () => {
    const wrapper = mount(ClientSelectDialog)

    expect(wrapper.find('.modal-overlay').exists()).toBe(true)
    expect(wrapper.text()).toContain('Search Existing')
    expect(wrapper.text()).toContain('Create New')
  })

  it('defaults to search mode — shows search input', () => {
    const wrapper = mount(ClientSelectDialog)

    expect(wrapper.find('input[placeholder*="Search"]').exists()).toBe(true)
  })

  it('clicking Create New tab shows the create form', async () => {
    const wrapper = mount(ClientSelectDialog)

    const createTab = wrapper.findAll('button').find(b => b.text() === 'Create New')
    await createTab!.trigger('click')

    expect(wrapper.find('input[placeholder="Ana"]').exists()).toBe(true)
    expect(wrapper.find('input[type="email"]').exists()).toBe(true)
  })

  it('search calls API and displays results', async () => {
    vi.mocked(clientManagementApi.list).mockResolvedValueOnce({
      data: { clients: mockClients, total: '2' },
    })

    const wrapper = mount(ClientSelectDialog)
    await wrapper.find('input[placeholder*="Search"]').setValue('Ana')
    await wrapper.find('button[class*="btn-primary"]').trigger('click')
    await flushPromises()

    expect(clientManagementApi.list).toHaveBeenCalledWith(
      expect.objectContaining({ nameFilter: 'Ana' })
    )
    expect(wrapper.text()).toContain('Ana Jović')
    expect(wrapper.text()).toContain('Marko Petrović')
  })

  it('clicking a search result emits selected with clientId', async () => {
    vi.mocked(clientManagementApi.list).mockResolvedValueOnce({
      data: { clients: mockClients, total: '2' },
    })

    const wrapper = mount(ClientSelectDialog)
    await wrapper.find('input[placeholder*="Search"]').setValue('Ana')
    await wrapper.find('button[class*="btn-primary"]').trigger('click')
    await flushPromises()

    const resultRow = wrapper.find('.client-result-row')
    await resultRow.trigger('click')

    expect(wrapper.emitted('selected')).toBeTruthy()
    expect(wrapper.emitted('selected')![0]).toEqual(['1'])
  })

  it('shows no-results message when search returns empty', async () => {
    vi.mocked(clientManagementApi.list).mockResolvedValueOnce({
      data: { clients: [], total: '0' },
    })

    const wrapper = mount(ClientSelectDialog)
    await wrapper.find('input[placeholder*="Search"]').setValue('xyz')
    await wrapper.find('button[class*="btn-primary"]').trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('No clients found')
  })

  it('create form validates required fields and shows error', async () => {
    const wrapper = mount(ClientSelectDialog)
    await wrapper.findAll('button').find(b => b.text() === 'Create New')!.trigger('click')

    await wrapper.find('button[class*="btn-primary"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('.global-error').exists()).toBe(true)
    expect(wrapper.text()).toContain('required')
  })

  it('create form calls API and emits selected with new clientId', async () => {
    vi.mocked(clientManagementApi.create).mockResolvedValueOnce({
      data: { client: { id: '99', ime: 'Nova', prezime: 'Osoba' } },
    })

    const wrapper = mount(ClientSelectDialog)
    await wrapper.findAll('button').find(b => b.text() === 'Create New')!.trigger('click')

    await wrapper.find('input[placeholder="Ana"]').setValue('Nova')
    await wrapper.find('input[placeholder="Jović"]').setValue('Osoba')
    await wrapper.find('input[type="email"]').setValue('nova@gmail.com')

    await wrapper.find('button[class*="btn-primary"]').trigger('click')
    await flushPromises()

    expect(clientManagementApi.create).toHaveBeenCalled()
    expect(wrapper.emitted('selected')).toBeTruthy()
    expect(wrapper.emitted('selected')![0]).toEqual(['99'])
  })

  it('close button emits close event', async () => {
    const wrapper = mount(ClientSelectDialog)
    await wrapper.find('.modal-close').trigger('click')

    expect(wrapper.emitted('close')).toBeTruthy()
  })

  it('clicking overlay emits close event', async () => {
    const wrapper = mount(ClientSelectDialog)
    await wrapper.find('.modal-overlay').trigger('click')

    expect(wrapper.emitted('close')).toBeTruthy()
  })
})
