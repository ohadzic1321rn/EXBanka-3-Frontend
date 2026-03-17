import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import AccountPortalView from '../../views/AccountPortalView.vue'
import { useAccountStore } from '../../stores/account'

const mockPush = vi.fn()

vi.mock('vue-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-router')>()
  return { ...actual, useRouter: () => ({ push: mockPush }) }
})

vi.mock('../../api/account', () => ({
  accountApi: {
    create: vi.fn(),
    get: vi.fn(),
    listByClient: vi.fn(),
    listAll: vi.fn(),
    updateName: vi.fn(),
    updateLimits: vi.fn(),
  },
  CURRENCIES: [
    { id: 1, kod: 'RSD', naziv: 'Serbian Dinar' },
    { id: 2, kod: 'EUR', naziv: 'Euro' },
  ],
}))

import { accountApi } from '../../api/account'

const mockAccounts = [
  {
    id: '1', brojRacuna: '111111111111111111', clientId: '10', firmaId: '0',
    currencyId: '2', currencyKod: 'EUR', tip: 'tekuci', vrsta: 'licni',
    stanje: 5000, raspolozivoStanje: 4500, dnevniLimit: 100000, mesecniLimit: 1000000,
    naziv: 'My account', status: 'aktivan',
  },
  {
    id: '2', brojRacuna: '222222222222222222', clientId: '11', firmaId: '0',
    currencyId: '1', currencyKod: 'RSD', tip: 'devizni', vrsta: 'poslovni',
    stanje: 100000, raspolozivoStanje: 100000, dnevniLimit: 500000, mesecniLimit: 5000000,
    naziv: '', status: 'blokiran',
  },
]

describe('AccountPortalView', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    vi.mocked(accountApi.listAll).mockResolvedValue({
      data: { accounts: mockAccounts, total: '2' },
    })
  })

  it('renders table with account column headers', async () => {
    const wrapper = mount(AccountPortalView)
    await flushPromises()

    expect(wrapper.find('table').exists()).toBe(true)
    expect(wrapper.text()).toContain('Account Number')
    expect(wrapper.text()).toContain('Currency')
    expect(wrapper.text()).toContain('Balance')
    expect(wrapper.text()).toContain('Status')
  })

  it('renders account rows after fetch', async () => {
    const wrapper = mount(AccountPortalView)
    await flushPromises()

    expect(wrapper.text()).toContain('111111111111111111')
    expect(wrapper.text()).toContain('222222222222222222')
    expect(wrapper.text()).toContain('EUR')
    expect(wrapper.text()).toContain('RSD')
  })

  it('calls fetchAllAccounts on mount', async () => {
    mount(AccountPortalView)
    await flushPromises()

    expect(accountApi.listAll).toHaveBeenCalledTimes(1)
  })

  it('renders filter dropdowns for tip, vrsta, status, currency', async () => {
    const wrapper = mount(AccountPortalView)
    await flushPromises()

    const selects = wrapper.findAll('select')
    expect(selects.length).toBeGreaterThanOrEqual(4)
  })

  it('renders Create Account button that navigates to /accounts/new', async () => {
    const wrapper = mount(AccountPortalView)
    await flushPromises()

    const btn = wrapper.findAll('button').find(b => b.text().includes('Create Account'))
    await btn!.trigger('click')

    expect(mockPush).toHaveBeenCalledWith('/accounts/new')
  })

  it('shows status badges for aktivan and blokiran', async () => {
    const wrapper = mount(AccountPortalView)
    await flushPromises()

    expect(wrapper.text()).toContain('aktivan')
    expect(wrapper.text()).toContain('blokiran')
  })

  it('opens detail modal when a row is clicked', async () => {
    vi.mocked(accountApi.get).mockResolvedValueOnce({
      data: { account: mockAccounts[0] },
    })

    const wrapper = mount(AccountPortalView)
    await flushPromises()

    const rows = wrapper.findAll('tbody tr')
    await rows[0].trigger('click')
    await flushPromises()

    expect(wrapper.find('.modal-overlay').exists()).toBe(true)
    expect(wrapper.text()).toContain('Account Details')
  })

  it('detail modal shows account fields', async () => {
    vi.mocked(accountApi.get).mockResolvedValueOnce({
      data: { account: mockAccounts[0] },
    })

    const wrapper = mount(AccountPortalView)
    await flushPromises()

    await wrapper.findAll('tbody tr')[0].trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('111111111111111111')
    expect(wrapper.text()).toContain('EUR')
    expect(wrapper.text()).toContain('100.000')
  })

  it('closes detail modal when close button clicked', async () => {
    vi.mocked(accountApi.get).mockResolvedValueOnce({
      data: { account: mockAccounts[0] },
    })

    const wrapper = mount(AccountPortalView)
    await flushPromises()

    await wrapper.findAll('tbody tr')[0].trigger('click')
    await flushPromises()
    expect(wrapper.find('.modal-overlay').exists()).toBe(true)

    await wrapper.find('.modal-close').trigger('click')
    expect(wrapper.find('.modal-overlay').exists()).toBe(false)
  })

  it('shows empty state when no accounts', async () => {
    vi.mocked(accountApi.listAll).mockResolvedValueOnce({
      data: { accounts: [], total: '0' },
    })

    const wrapper = mount(AccountPortalView)
    await flushPromises()

    expect(wrapper.text()).toContain('No accounts found')
  })
})
