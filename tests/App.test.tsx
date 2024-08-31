import { act, fireEvent, render, waitFor } from "@testing-library/react"
import { randomAddress } from "@ton/test-utils"
import { toNano } from "@ton/core"
import "@testing-library/jest-dom"

const makeImportsSpyable = (toCheck: { path: string, componentsToMock?: string[] }[]) =>
    toCheck.forEach(({ path, componentsToMock: propsToMock }) => jest.mock(path, () => ({
        __esModule: true,
        ...jest.requireActual(path),
        ...propsToMock?.reduce((acc: any, curr) => {
            acc[curr] = jest.fn()
            return acc
        }, {})
    })))

makeImportsSpyable([
    { path: "use-ton-connect-sender" },
    { path: "@tonconnect/ui-react", componentsToMock: ["TonConnectUIProvider", "TonConnectButton"] },
])

import App, { AMOUNT_FOR_GAS, CONTRACT_MAINNET_ADDRESS, CONTRACT_TESTNET_ADDRESS } from "../src/App.tsx"



describe("Testing the example deposit/withdrawal DApp", () => {
    const getBalanceMock = jest.fn()

    let useTonContractMock = jest.fn()

    const clientSenderMock = jest.fn()
    let senderAvailable: boolean

    const TON_WALLET_ADDRESS = randomAddress().toString()
    const TON_DIFFERENT_ADDRESS = randomAddress().toString()
    const getOwnerMock = jest.fn()
    let tonOwnerAddress: string

    const tonContractStub = {
        getBalance: getBalanceMock,
        send: clientSenderMock,
        getOwner: getOwnerMock,
    } as any

    const senderStub = {
        address: TON_WALLET_ADDRESS,
        send: jest.fn() as any
    } as any

    beforeEach(async () => {
        jest.resetAllMocks()
        jest.useRealTimers()
        senderAvailable = true

        useTonContractMock = jest.spyOn(await import("use-ton-connect-sender"), "useTonContract")
            .mockReturnValue(tonContractStub) as any
        jest.spyOn(await import("use-ton-connect-sender"), "useTonConnectSender")
            .mockImplementation((() => ({
                sender: senderAvailable ? senderStub : undefined,
                tonConnectUI: jest.fn() as any
            })) as any)

        const uiReactImport = await import("@tonconnect/ui-react")
        jest.spyOn(uiReactImport, "TonConnectUIProvider")
            .mockImplementation(({ children }: { children: any }) => {
                return <>{children}</>
            })
        jest.spyOn(uiReactImport, "TonConnectButton").mockReturnValue(<></>)

        tonOwnerAddress = TON_WALLET_ADDRESS
        getOwnerMock.mockImplementation(() => Promise.resolve(tonOwnerAddress))
    })

    test("Should display loading message when the component is not yet loaded", async () => {
        // GIVEN the contract reports 1 TON balance
        useTonContractMock.mockReturnValue(undefined)

        // WHEN rendering the component
        const { getByTestId } = await act(() => act(() => render(<App />)))

        // THEN the contract balance is shown
        expect(getByTestId("contractAmount")).toHaveTextContent("Loading...")
    })

    test("Should load the component and display the contract's balance", async () => {
        // GIVEN the contract's getBalance returns the value of 1 TON in nano
        getBalanceMock.mockReturnValue(1_000_000_000n)

        // WHEN rendering the component
        const { getByTestId } = await act(() => act(() => render(<App />)))

        // THEN the component should display the contract's balance as 1 TON 0 nano
        expect(getByTestId("contractAmount")).toHaveTextContent("1 TON 0 nano")
    })

    test("Should refresh the wallet on timer", async () => {
        // GIVEN using the test timers
        jest.useFakeTimers()

        // AND the contract reports 1 TON balance
        getBalanceMock.mockReturnValue(1_000_000_000n)

        // AND rendering the component
        const { getByTestId } = await act(() => act(() => render(<App />)))

        // WHEN changing the wallet balance
        getBalanceMock.mockReturnValue(2_000_000_000n)

        // AND advancing the timer to the next waiting point
        jest.advanceTimersToNextTimer()

        // THEN the contract balance is shown
        await waitFor(() => expect(getByTestId("contractAmount")).toHaveTextContent("2 TON 0 nano"))
    })

    test("Should initialize the testnet connection when the corresponding button is selected", async () => {
        // GIVEN the component is rendered
        const { getByTestId } = await act(() => act(() => render(<App />)))

        // WHEN clicking the testnet button
        await act(() => fireEvent.click(getByTestId("testNetSelector")))

        // THEN the testnet connection is initialized
        expect(useTonContractMock).toHaveBeenCalledWith(
            "testnet",
            CONTRACT_TESTNET_ADDRESS,
            expect.anything()
        )
    })

    test("Should initialize the mainnet connection when the corresponding button is selected after the testnet one", async () => {
        // GIVEN the component is rendered
        const { getByTestId } = await act(() => act(() => render(<App />)))

        // WHEN clicking the testnet testnet button
        await act(() => act(() => fireEvent.click(getByTestId("testNetSelector"))))

        // AND forgetting the previous contract initialization history
        useTonContractMock.mockClear()

        // AND clicking the mainnet button
        await act(() => act(() => fireEvent.click(getByTestId("mainNetSelector"))))

        // THEN the mainnet connection is initialized
        expect(useTonContractMock).toHaveBeenCalledWith(
            "mainnet",
            CONTRACT_MAINNET_ADDRESS,
            expect.anything()
        )
    })

    test("Should send a deposit on button click", async () => {
        // GIVEN the component is rendered
        const { getByTestId } = await act(() => act(() => render(<App />)))

        // WHEN entering a positive deposit value
        fireEvent.change(getByTestId("depositInput"), { target: { value: 1.5 } })

        // AND clicking the deposit button
        await act(() => act(() => fireEvent.click(getByTestId("depositButton"))))

        // THEN the deposit transaction is sent
        expect(clientSenderMock).toHaveBeenCalledWith(
            expect.anything(),
            { value: toNano("1.5") },
            { "$$type": "Deposit" }
        )
    })

    test("Should disable the deposit button if non-positive deposit value is entered", async () => {
        // GIVEN the component is rendered
        const { getByTestId } = await act(() => act(() => render(<App />)))

        // WHEN entering a non-positive deposit value
        await act(() => fireEvent.change(getByTestId("depositInput"), { target: { value: 0 } }))

        // THEN the deposit button is disabled
        await waitFor(() => expect(getByTestId("depositButton")).toBeDisabled())
    })

    test("Should disable the deposit button if the contract is not connected", async () => {
        // GIVEN the contract is not connected
        senderAvailable = false

        // AND the component is rendered
        const { getByTestId } = await act(() => act(() => render(<App />)))

        // WHEN entering a positive deposit value
        await act(() => fireEvent.change(getByTestId("depositInput"), { target: { value: 1.5 } }))

        // THEN the deposit button is not enabled
        await waitFor(() => expect(getByTestId("depositButton")).toBeDisabled())
    })

    test("Should send a withdrawal on button click", async () => {
        // GIVEN the component is rendered
        const { getByTestId } = await act(() => act(() => render(<App />)))

        // WHEN entering a positive deposit value
        fireEvent.change(getByTestId("withdrawInput"), { target: { value: 1.5 } })

        // AND clicking the deposit button
        await act(() => act(() => fireEvent.click(getByTestId("withdrawButton"))))

        // THEN the deposit transaction is sent
        expect(clientSenderMock).toHaveBeenCalledWith(
            expect.anything(),
            { value: AMOUNT_FOR_GAS },
            {
                "$$type": "Withdrawal",
                amount: toNano("1.5")
            }
        )
    })

    test("Should disable the withdrawal button if the contract is connected and a non-positive deposit value is entered", async () => {
        // GIVEN the component is rendered
        const { getByTestId } = await act(() => act(() => render(<App />)))

        // WHEN entering a non-positive deposit value
        fireEvent.change(getByTestId("withdrawInput"), { target: { value: 0 } })

        // THEN the deposit button is disabled
        await waitFor(() => expect(getByTestId("withdrawButton")).toBeDisabled())
    })

    test("Should disable the withdrawal button if the contract is not connected", async () => {
        // GIVEN the contract is not connected
        senderAvailable = false

        // AND the component is rendered
        const { getByTestId } = await act(() => act(() => render(<App />)))

        // WHEN entering a positive deposit value
        await act(() => fireEvent.change(getByTestId("withdrawInput"), { target: { value: 1.5 } }))

        // THEN the deposit button is not enabled
        await waitFor(() => expect(getByTestId("withdrawButton")).toBeDisabled())
    })

    test("Should disable the withdrawal button if the conected wallet is not the owner of the contract", async () => {
        // GIVEN the wallet is not the owner of the contract
        tonOwnerAddress = TON_DIFFERENT_ADDRESS

        // AND the component is rendered
        const { getByTestId } = await act(() => act(() => render(<App />)))

        // WHEN entering a positive deposit value
        await act(() => fireEvent.change(getByTestId("withdrawInput"), { target: { value: 1.5 } }))

        // THEN the deposit button is not enabled
        await waitFor(() => expect(getByTestId("withdrawButton")).toBeDisabled())
    })
})