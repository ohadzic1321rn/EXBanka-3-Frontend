import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import ClientNewPaymentView from '../../views/client/ClientNewPaymentView.vue'
import { useClientAuthStore } from '../../stores/clientAuth'

const mockPush = vi.fn()

vi.mock('vue-router', async (importOriginal) => {
  const actual = await importOriginal<typeof import('vue-router')>()
  return { ...actual, useRouter: () => ({ push: mockPush }) }
})

vi.mock('../../api/payment', () => ({
  paymentApi: { create: vi.fn(), verify: vi.fn(), listByClient: vi.fn(), listByAccount: vi.fn(), get: vi.fn() },
  SIFRE_PLACANJA: [
    { sifra: '221', naziv: 'Plaćanje robe' },
    { sifra: '289', naziv: 'Ostala plaćanja' },
  ],
}))

vi.mock('../../api/clientAccount', () => ({
  clientAccountApi: { listByClient: vi.fn(), get: vi.fn() },
}))

vi.mock('../../api/recipient', () => ({
  recipientApi: { listByClient: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
}))

vi.mock('../../api/clientAuth', () => ({
  clientAuthApi: { login: vi.fn() },
  default: { get: vi.fn(), post: vi.fn(), interceptors: { request: { use: vi.fn() } } },
}))

import { paymentApi } from '../../api/payment'
import { clientAccountApi } from '../../api/clientAccount'
import { recipientApi } from '../../api/recipient'

const mockAccounts = [
  {
    id: '1', brojRacuna: '111111111111111111', clientId: '5', firmaId: '0',
    currencyId: '1', currencyKod: 'RSD', tip: 'tekuci', vrsta: 'licni',
    stanje: 50000, raspolozivoStanje: 50000, dnevniLimit: 100000, mesecniLimit: 1000000,
    naziv: 'RSD račun', status: 'aktivan',
  },
]

const mockRecipients = [
  { id: '10', clientId: '5', naziv: 'EPS', brojRacuna: '999999999999999999' },
]

const mockPayment = {
  id: 'p1',
  racunPosiljaocaId: '1',
  racunPrimaocaBroj: '999999999999999999',
  iznos: 5000,
  sifraPlacanja: '289',
  pozivNaBroj: '',
  svrha: 'Struja',
  status: 'u_obradi',
  verifikacioniKod: '123456',
  vremeTransakcije: '2026-03-01T10:00:00Z',
}

async function goToVerifyStep(wrapper: ReturnType<typeof mount>) {
  vi.mocked(paymentApi.create).mockResolvedValueOnce({ data: { payment: mockPayment } })
  const selects = wrapper.findAll('select')
  // selects[0]=savedRecipientId, selects[1]=sifraPlacanja, selects[2]=fromAccountId
  await selects[2].setValue('1')
  await selects[0].setValue('10')
  await wrapper.find('input[type="number"]').setValue('5000')
  await wrapper.find('input[placeholder="Svrha plaćanja"]').setValue('Struja')
  await wrapper.findAll('button').find(b => b.text() === 'Nastavi')!.trigger('click')
  await wrapper.findAll('button').find(b => b.text().includes('Potvrdi'))!.trigger('click')
  await flushPromises()
}

describe('ClientNewPaymentView', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()

    const authStore = useClientAuthStore()
    authStore.accessToken = 'test-token'
    authStore.client = { id: '5', ime: 'Ana', prezime: 'Jović', email: 'ana@gmail.com', permissions: ['client.basic'] }

    vi.mocked(clientAccountApi.listByClient).mockResolvedValue({ data: { accounts: mockAccounts } })
    vi.mocked(recipientApi.listByClient).mockResolvedValue({ data: { recipients: mockRecipients } })
  })

  it('renders Novo plaćanje heading', async () => {
    const wrapper = mount(ClientNewPaymentView)
    await flushPromises()
    expect(wrapper.text()).toContain('Novo plaćanje')
  })

  it('loads accounts and recipients on mount', async () => {
    mount(ClientNewPaymentView)
    await flushPromises()
    expect(clientAccountApi.listByClient).toHaveBeenCalledWith('5')
    expect(recipientApi.listByClient).toHaveBeenCalledWith('5')
  })

  it('shows account dropdown with loaded accounts', async () => {
    const wrapper = mount(ClientNewPaymentView)
    await flushPromises()
    expect(wrapper.text()).toContain('RSD račun')
  })

  it('shows saved recipient dropdown by default', async () => {
    const wrapper = mount(ClientNewPaymentView)
    await flushPromises()
    expect(wrapper.text()).toContain('EPS')
    expect(wrapper.text()).toContain('Iz liste')
  })

  it('switching to manual mode shows account number input', async () => {
    const wrapper = mount(ClientNewPaymentView)
    await flushPromises()

    const manualBtn = wrapper.findAll('button').find(b => b.text() === 'Ručni unos')!
    await manualBtn.trigger('click')
    await wrapper.vm.$nextTick()

    expect(wrapper.find('input[placeholder="Broj računa primaoca (18 cifara)"]').exists()).toBe(true)
  })

  it('shows šifra plaćanja dropdown', async () => {
    const wrapper = mount(ClientNewPaymentView)
    await flushPromises()
    expect(wrapper.text()).toContain('Šifra plaćanja')
    expect(wrapper.text()).toContain('289')
  })

  it('shows validation error when form incomplete and Nastavi clicked', async () => {
    const wrapper = mount(ClientNewPaymentView)
    await flushPromises()

    await wrapper.findAll('button').find(b => b.text() === 'Nastavi')!.trigger('click')
    expect(wrapper.text()).toContain('Izaberite račun platioca')
  })

  it('moves to confirm step when form is filled', async () => {
    const wrapper = mount(ClientNewPaymentView)
    await flushPromises()

    const selects = wrapper.findAll('select')
    // selects[0]=savedRecipientId, selects[1]=sifraPlacanja, selects[2]=fromAccountId
    await selects[2].setValue('1')
    await selects[0].setValue('10')

    const iznosInput = wrapper.find('input[type="number"]')
    await iznosInput.setValue('5000')

    const svrhaInput = wrapper.find('input[placeholder="Svrha plaćanja"]')
    await svrhaInput.setValue('Struja')

    await wrapper.findAll('button').find(b => b.text() === 'Nastavi')!.trigger('click')

    expect(wrapper.text()).toContain('Pregled naloga')
    expect(wrapper.text()).toContain('999999999999999999')
    expect(wrapper.text()).toContain('Struja')
  })

  it('Nazad from confirm returns to form', async () => {
    const wrapper = mount(ClientNewPaymentView)
    await flushPromises()

    const selects = wrapper.findAll('select')
    await selects[2].setValue('1')
    await selects[0].setValue('10')
    await wrapper.find('input[type="number"]').setValue('100')
    await wrapper.find('input[placeholder="Svrha plaćanja"]').setValue('Test')
    await wrapper.findAll('button').find(b => b.text() === 'Nastavi')!.trigger('click')

    expect(wrapper.text()).toContain('Pregled naloga')
    await wrapper.findAll('button').find(b => b.text() === 'Nazad')!.trigger('click')
    expect(wrapper.text()).toContain('Račun platioca')
  })

  it('Potvrdi calls create API and moves to verify step', async () => {
    const wrapper = mount(ClientNewPaymentView)
    await flushPromises()
    await goToVerifyStep(wrapper)

    expect(paymentApi.create).toHaveBeenCalledOnce()
    expect(wrapper.text()).toContain('Verifikacija')
    expect(wrapper.text()).toContain('6-cifreni')
  })

  it('verify step shows countdown timer starting at 5:00', async () => {
    const wrapper = mount(ClientNewPaymentView)
    await flushPromises()
    await goToVerifyStep(wrapper)

    expect(wrapper.text()).toContain('5:00')
  })

  it('Potvrdi kod with correct code moves to success', async () => {
    vi.mocked(paymentApi.verify).mockResolvedValueOnce({
      data: { payment: { ...mockPayment, status: 'uspesno' } },
    })

    const wrapper = mount(ClientNewPaymentView)
    await flushPromises()
    await goToVerifyStep(wrapper)

    await wrapper.find('input[maxlength="6"]').setValue('123456')
    await wrapper.findAll('button').find(b => b.text() === 'Potvrdi kod')!.trigger('click')
    await flushPromises()

    expect(paymentApi.verify).toHaveBeenCalledWith('p1', '123456')
    expect(wrapper.text()).toContain('uspešno realizovana')
  })

  it('wrong verification code shows error', async () => {
    vi.mocked(paymentApi.verify).mockRejectedValueOnce({
      response: { data: { message: 'Neispravan kod' } },
    })

    const wrapper = mount(ClientNewPaymentView)
    await flushPromises()
    await goToVerifyStep(wrapper)

    await wrapper.find('input[maxlength="6"]').setValue('000000')
    await wrapper.findAll('button').find(b => b.text() === 'Potvrdi kod')!.trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('Neispravan kod')
  })

  it('verify step shows remaining attempts starting at 3', async () => {
    const wrapper = mount(ClientNewPaymentView)
    await flushPromises()
    await goToVerifyStep(wrapper)

    expect(wrapper.text()).toContain('Preostalo pokušaja: 3')
  })

  it('shows fewer remaining attempts after a wrong code', async () => {
    vi.mocked(paymentApi.verify).mockRejectedValueOnce({
      response: { data: { message: 'invalid verification code' } },
    })

    const wrapper = mount(ClientNewPaymentView)
    await flushPromises()
    await goToVerifyStep(wrapper)

    await wrapper.find('input[maxlength="6"]').setValue('000000')
    await wrapper.findAll('button').find(b => b.text() === 'Potvrdi kod')!.trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('Preostalo pokušaja: 2')
  })

  it('success step has Novo plaćanje button that resets form', async () => {
    vi.mocked(paymentApi.verify).mockResolvedValueOnce({
      data: { payment: { ...mockPayment, status: 'uspesno' } },
    })

    const wrapper = mount(ClientNewPaymentView)
    await flushPromises()
    await goToVerifyStep(wrapper)
    await wrapper.find('input[maxlength="6"]').setValue('123456')
    await wrapper.findAll('button').find(b => b.text() === 'Potvrdi kod')!.trigger('click')
    await flushPromises()

    await wrapper.findAll('button').find(b => b.text() === 'Novo plaćanje')!.trigger('click')
    expect(wrapper.text()).toContain('Račun platioca')
  })
})
