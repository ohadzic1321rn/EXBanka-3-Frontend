import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import ClientTransfersView from '../../views/client/ClientTransfersView.vue'
import { useClientAuthStore } from '../../stores/clientAuth'
import { useClientAccountStore } from '../../stores/clientAccount'

vi.mock('vue-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-router')>()
  return {
    ...actual,
    useRoute: () => ({ query: {} }),
    useRouter: () => ({ push: vi.fn() }),
  }
})

vi.mock('../../api/transfer', () => ({
  transferApi: {
    create: vi.fn(),
    verify: vi.fn(),
    listByClient: vi.fn(),
    listByAccount: vi.fn(),
    calculateExchange: vi.fn(),
  },
}))

vi.mock('../../api/clientAccount', () => ({
  clientAccountApi: { listByClient: vi.fn(), get: vi.fn() },
}))

vi.mock('../../api/clientAuth', () => ({
  clientAuthApi: { login: vi.fn() },
  default: { get: vi.fn(), post: vi.fn(), interceptors: { request: { use: vi.fn() } } },
}))

import { transferApi } from '../../api/transfer'
import { clientAccountApi } from '../../api/clientAccount'

const mockAccounts = [
  {
    id: '1', brojRacuna: '111111111111111111', clientId: '5', firmaId: '0',
    currencyId: '1', currencyKod: 'RSD', tip: 'tekuci', vrsta: 'licni',
    stanje: 50000, raspolozivoStanje: 50000, dnevniLimit: 100000, mesecniLimit: 1000000,
    naziv: 'RSD Account', status: 'aktivan',
  },
  {
    id: '2', brojRacuna: '222222222222222222', clientId: '5', firmaId: '0',
    currencyId: '2', currencyKod: 'EUR', tip: 'devizni', vrsta: 'licni',
    stanje: 500, raspolozivoStanje: 450, dnevniLimit: 10000, mesecniLimit: 100000,
    naziv: 'EUR Account', status: 'aktivan',
  },
]

const mockTransfers = [
  {
    id: '1',
    racunPosiljaocaId: '1',
    racunPrimaocaId: '2',
    iznos: 1000,
    valutaIznosa: 'RSD',
    konvertovaniIznos: 1000,
    kurs: 1,
    svrha: 'Kirija',
    status: 'uspesno',
    vremeTransakcije: '2026-03-01T10:00:00Z',
  },
]

describe('ClientTransfersView', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()

    const authStore = useClientAuthStore()
    authStore.accessToken = 'test-token'
    authStore.client = { id: '5', ime: 'Ana', prezime: 'Jović', email: 'ana@gmail.com', permissions: ['client.basic'] }

    vi.mocked(clientAccountApi.listByClient).mockResolvedValue({
      data: { accounts: mockAccounts },
    })

    vi.mocked(transferApi.listByClient).mockResolvedValue({
      data: { transfers: mockTransfers, total: 1 },
    })
  })

  it('renders Novi transfer heading', async () => {
    const wrapper = mount(ClientTransfersView)
    await flushPromises()
    expect(wrapper.text()).toContain('Novi transfer')
  })

  it('loads accounts and transfers on mount', async () => {
    mount(ClientTransfersView)
    await flushPromises()
    expect(clientAccountApi.listByClient).toHaveBeenCalledWith('5')
    expect(transferApi.listByClient).toHaveBeenCalledWith('5', expect.any(Object))
  })

  it('populates source account dropdown', async () => {
    const wrapper = mount(ClientTransfersView)
    await flushPromises()
    const selects = wrapper.findAll('select')
    expect(selects.length).toBeGreaterThanOrEqual(1)
    expect(selects[0].text()).toContain('RSD Account')
    expect(selects[0].text()).toContain('EUR Account')
  })

  it('shows transfer history with transfers', async () => {
    const wrapper = mount(ClientTransfersView)
    await flushPromises()
    expect(wrapper.text()).toContain('Kirija')
    expect(wrapper.text()).toContain('Uspešno')
  })

  it('shows empty state when no transfers', async () => {
    vi.mocked(transferApi.listByClient).mockResolvedValueOnce({
      data: { transfers: [], total: 0 },
    })
    const wrapper = mount(ClientTransfersView)
    await flushPromises()
    expect(wrapper.text()).toContain('Nema transfera')
  })

  it('Nastavi button is disabled when form is incomplete', async () => {
    const wrapper = mount(ClientTransfersView)
    await flushPromises()
    const nastaviBtn = wrapper.findAll('button').find(b => b.text() === 'Nastavi')
    expect(nastaviBtn).toBeDefined()
    expect(nastaviBtn!.attributes('disabled')).toBeDefined()
  })

  it('moves to confirm step when form is filled and Nastavi clicked', async () => {
    const wrapper = mount(ClientTransfersView)
    await flushPromises()

    const selects = wrapper.findAll('select')
    await selects[0].setValue('1')
    await selects[1].setValue('2')

    const inputs = wrapper.findAll('input')
    const iznosInput = inputs.find(i => i.attributes('type') === 'number')
    await iznosInput!.setValue('1000')

    const svrhaInput = inputs.find(i => i.attributes('placeholder') === 'Svrha transakcije')
    await svrhaInput!.setValue('Test')

    await wrapper.vm.$nextTick()

    const nastaviBtn = wrapper.findAll('button').find(b => b.text() === 'Nastavi')
    await nastaviBtn!.trigger('click')

    expect(wrapper.text()).toContain('Potvrdi transfer')
  })

  it('after Potvrdi the verify step is shown with code input', async () => {
    vi.mocked(transferApi.create).mockResolvedValueOnce({
      data: { transfer: { ...mockTransfers[0], status: 'u_obradi' } },
    })

    const wrapper = mount(ClientTransfersView)
    await flushPromises()

    const selects = wrapper.findAll('select')
    await selects[0].setValue('1')
    await selects[1].setValue('2')

    const inputs = wrapper.findAll('input')
    await inputs.find(i => i.attributes('type') === 'number')!.setValue('1000')
    await inputs.find(i => i.attributes('placeholder') === 'Svrha transakcije')!.setValue('Test')
    await wrapper.vm.$nextTick()

    await wrapper.findAll('button').find(b => b.text() === 'Nastavi')!.trigger('click')
    await wrapper.findAll('button').find(b => b.text().includes('Potvrdi'))!.trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('verifikacioni kod')
  })

  it('shows success after valid verification code is submitted', async () => {
    vi.mocked(transferApi.create).mockResolvedValueOnce({
      data: { transfer: { ...mockTransfers[0], status: 'u_obradi' } },
    })
    vi.mocked(transferApi.verify).mockResolvedValueOnce({
      data: { id: '1', status: 'uspesno' },
    })

    const wrapper = mount(ClientTransfersView)
    await flushPromises()

    const selects = wrapper.findAll('select')
    await selects[0].setValue('1')
    await selects[1].setValue('2')

    const inputs = wrapper.findAll('input')
    await inputs.find(i => i.attributes('type') === 'number')!.setValue('1000')
    await inputs.find(i => i.attributes('placeholder') === 'Svrha transakcije')!.setValue('Test')
    await wrapper.vm.$nextTick()

    await wrapper.findAll('button').find(b => b.text() === 'Nastavi')!.trigger('click')
    await wrapper.findAll('button').find(b => b.text().includes('Potvrdi'))!.trigger('click')
    await flushPromises()

    // Enter 6-digit verification code
    const codeInput = wrapper.find('input[maxlength="6"]')
    await codeInput.setValue('123456')
    await wrapper.findAll('button').find(b => b.text().includes('Verifikuj'))!.trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('uspešno realizovan')
  })

  it('verify step shows remaining attempts starting at 3', async () => {
    vi.mocked(transferApi.create).mockResolvedValueOnce({
      data: { transfer: { ...mockTransfers[0], status: 'u_obradi' } },
    })

    const wrapper = mount(ClientTransfersView)
    await flushPromises()

    const selects = wrapper.findAll('select')
    await selects[0].setValue('1')
    await selects[1].setValue('2')

    const inputs = wrapper.findAll('input')
    await inputs.find(i => i.attributes('type') === 'number')!.setValue('1000')
    await inputs.find(i => i.attributes('placeholder') === 'Svrha transakcije')!.setValue('Test')
    await wrapper.vm.$nextTick()

    await wrapper.findAll('button').find(b => b.text() === 'Nastavi')!.trigger('click')
    await wrapper.findAll('button').find(b => b.text().includes('Potvrdi'))!.trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('Preostalo pokušaja: 3')
  })

  it('verify step shows countdown timer starting at 5:00', async () => {
    vi.mocked(transferApi.create).mockResolvedValueOnce({
      data: { transfer: { ...mockTransfers[0], status: 'u_obradi' } },
    })

    const wrapper = mount(ClientTransfersView)
    await flushPromises()

    const selects = wrapper.findAll('select')
    await selects[0].setValue('1')
    await selects[1].setValue('2')

    const inputs = wrapper.findAll('input')
    await inputs.find(i => i.attributes('type') === 'number')!.setValue('1000')
    await inputs.find(i => i.attributes('placeholder') === 'Svrha transakcije')!.setValue('Test')
    await wrapper.vm.$nextTick()

    await wrapper.findAll('button').find(b => b.text() === 'Nastavi')!.trigger('click')
    await wrapper.findAll('button').find(b => b.text().includes('Potvrdi'))!.trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('5:00')
  })
})
