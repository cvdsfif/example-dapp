import { act, fireEvent, render, waitFor } from "@testing-library/react"
import { randomAddress } from "@ton/test-utils"
import "@testing-library/jest-dom"
import { Sender, toNano, TonClient, TonClientParameters } from "@ton/ton"
import { TonConnectUI, TonConnectUiOptions, useTonAddress } from "@tonconnect/ui-react"
import { Deploy, Deposit, Withdrawal } from "../src/contracts/tact_NzComTact"

jest.mock(
    "@tonconnect/ui-react",
    () => ({
        TonConnectUIProvider: ({ children }: { children: any }) => {
            return <>{children}</>
        },
        TonConnectButton: () => <></>,
        useTonAddress: jest.fn(),
        useTonConnectUI: jest.fn()
    })
)

import App, { AMOUNT_FOR_GAS } from "../src/App"


describe("Testing the example deposit/withdrawal DApp", () => {
    const getBalanceMock = jest.fn()
    const getHttpEndpointMock = jest.fn()
    const getOwnerMock = jest.fn()

    const clientSenderMock = jest.fn()
    const tonClientStub = {
        getBalance: getBalanceMock,
        send: clientSenderMock,
        getOwner: getOwnerMock
    }
    let connectSenderExtracted: Sender

    const sendTransactionMock = jest.fn()
    const TON_OWNER_ADDRESS = randomAddress().toString()
    let tonClientAddress: string

    beforeEach(async () => {
        jest.resetAllMocks()
        jest.useRealTimers()
        jest.spyOn(await import("@ton/ton"), "TonClient").mockImplementation(
            (_: TonClientParameters) => ({
                open: () => tonClientStub
            }) as unknown as TonClient
        )
        jest.spyOn(await import("@orbs-network/ton-access"), "getHttpEndpoint").mockImplementation(getHttpEndpointMock)

        tonClientAddress = TON_OWNER_ADDRESS
        jest.spyOn(await import("@tonconnect/ui-react"), "useTonAddress").mockImplementation(() => tonClientAddress)
        jest.spyOn(await import("@tonconnect/ui-react"), "useTonConnectUI")
            .mockImplementation(() => ([
                {
                    sendTransaction: sendTransactionMock
                } as unknown as TonConnectUI,
                (_: TonConnectUiOptions) => { }
            ]))
        clientSenderMock.mockImplementation((via: Sender, _: { value: bigint }, message: Deposit | Withdrawal | Deploy) => {
            connectSenderExtracted = via
        })
        getOwnerMock.mockImplementation(() => Promise.resolve(TON_OWNER_ADDRESS))
    })

    test("Should load the component and display the contract's balance", async () => {
        // GIVEN the contract's getBalance returns the value of 1 TON in nano
        getBalanceMock.mockReturnValue(1_000_000_000n)

        // WHEN rendering the component
        const { getByTestId } = await act(() => render(<App />))

        // THEN the component should display the contract's balance as 1 TON 0 nano
        expect(getByTestId("contractAmount")).toHaveTextContent("1 TON 0 nano")
    })

    test("Should refresh the wallet on timer", async () => {
        // GIVEN using the test timers
        jest.useFakeTimers()

        // AND the contract reports 1 TON balance
        getBalanceMock.mockReturnValue(1_000_000_000n)

        // AND rendering the component
        const { getByTestId } = await act(() => render(<App />))

        // WHEN changing the wallet balance
        getBalanceMock.mockReturnValue(2_000_000_000n)

        // AND advancing the timer to the next waiting point
        jest.advanceTimersToNextTimer()

        // THEN the contract balance is shown
        await waitFor(() => expect(getByTestId("contractAmount")).toHaveTextContent("2 TON 0 nano"))
    })

    test("Should initialize the testnet connection when the corresponding radio button is selected", async () => {
        // GIVEN the component is rendered
        const { getByTestId } = await act(() => render(<App />))

        // WHEN clicking the testnet button
        await act(() => act(() => fireEvent.click(getByTestId("testNetSelector"))))

        // THEN the testnet connection is initialized
        expect(getHttpEndpointMock).toHaveBeenCalledWith({ network: "testnet" })
    })

    test("Should initialize the mainnet connection when the corresponding button is selected after the testnet one", async () => {
        // GIVEN the component is rendered
        const { getByTestId } = await act(() => render(<App />))

        // WHEN clicking the testnet-mainnet buttons sequense
        await act(() => act(() => fireEvent.click(getByTestId("testNetSelector"))))
        await act(() => act(() => fireEvent.click(getByTestId("mainNetSelector"))))

        // THEN the mainnet connection is initialized after
        expect(getHttpEndpointMock).toHaveBeenNthCalledWith(3, { network: "mainnet" })
    })

    test("Should translate sending message to a transaction on connect UI", async () => {
        // GIVEN the component is rendered
        const { getByTestId } = await act(() => render(<App />))

        // AND entering a positive deposit value
        fireEvent.change(getByTestId("depositInput"), { target: { value: 1.5 } })

        // AND clicking the deposit button
        await act(() => act(() => fireEvent.click(getByTestId("depositButton"))))

        // WHEN calling the extracted sender
        connectSenderExtracted.send({
            to: TON_OWNER_ADDRESS,
            value: toNano("1.5"),
            data: { "$$type": "Deposit" }
        } as any)

        // THEN the transaction is sent via TON connect UI
        expect(sendTransactionMock).toHaveBeenCalledWith(expect.objectContaining({
            messages: [{
                address: TON_OWNER_ADDRESS,
                amount: "1500000000"
            }]
        }))

        // AND the depositAmount is set back to zero
        expect(getByTestId("depositInput")).toHaveValue("0")
    })

    test("Should send a deposit on button click", async () => {
        // GIVEN the component is rendered
        const { getByTestId } = await act(() => render(<App />))

        // WHEN entering a positive deposit value
        await act(() => act(() => fireEvent.change(getByTestId("depositInput"), { target: { value: 1.5 } })))

        // AND clicking the deposit button
        await act(() => act(() => fireEvent.click(getByTestId("depositButton"))))

        // THEN the deposit transaction is sent
        expect(clientSenderMock).toHaveBeenCalledWith(
            expect.anything(),
            { value: toNano("1.5") },
            { "$$type": "Deposit" }
        )
    })

    test("Should disable the deposit button if the contract is not connected", async () => {
        // GIVEN the contract is not connected
        tonClientAddress = ""

        // AND the component is rendered
        const { getByTestId } = await act(() => render(<App />))

        // WHEN entering a positive deposit value
        fireEvent.change(getByTestId("depositInput"), { target: { value: 1.5 } })

        // THEN the deposit button is not enabled
        await waitFor(() => expect(getByTestId("depositButton")).toBeDisabled())
    })

    test("Should disable the deposit button if the contract is connected, but a positive deposit value is not entered", async () => {
        // GIVEN the component is rendered
        const { getByTestId } = await act(() => render(<App />))

        // WHEN entering a zero deposit value
        fireEvent.change(getByTestId("depositInput"), { target: { value: 0 } })

        // THEN the deposit button is disabled
        await waitFor(() => expect(getByTestId("depositButton")).toBeDisabled())
    })

    test("Should send a withdrawal on button click", async () => {
        // GIVEN the component is rendered
        const { getByTestId } = await act(() => render(<App />))

        // WHEN entering a positive deposit value
        await act(() => act(() => fireEvent.change(getByTestId("withdrawInput"), { target: { value: 1.5 } })))

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

    test("Should disable the withdrawal button if the contract is connected and a zero withdrawal value is entered", async () => {
        // GIVEN the component is rendered
        const { getByTestId } = await act(() => render(<App />))

        // WHEN entering a zero deposit value
        fireEvent.change(getByTestId("withdrawInput"), { target: { value: 0 } })

        // THEN the deposit button is disnabled
        await waitFor(() => expect(getByTestId("withdrawButton")).toBeDisabled())
    })

    test("Should disable the withdrawal button if the contract is not connected", async () => {
        // GIVEN the contract is not connected
        tonClientAddress = ""

        // AND the component is rendered
        const { getByTestId } = await act(() => render(<App />))

        // WHEN entering a positive deposit value
        fireEvent.change(getByTestId("withdrawInput"), { target: { value: 1.5 } })

        // THEN the deposit button is not enabled
        await waitFor(() => expect(getByTestId("withdrawButton")).toBeDisabled())
    })

    const TON_DIFFERENT_ADDRESS = randomAddress().toString()

    test("Should disable the withdrawal button and input area if the conected wallet is not the owner of the contract", async () => {
        // GIVEN the wallet is not the owner of the contract
        tonClientAddress = TON_DIFFERENT_ADDRESS

        // AND the component is rendered
        const { getByTestId } = await act(() => render(<App />))

        // WHEN entering a positive deposit value
        fireEvent.change(getByTestId("withdrawInput"), { target: { value: 1.5 } })

        // THEN the deposit button is not enabled
        await waitFor(() => expect(getByTestId("withdrawButton")).toBeDisabled())

        // AND the withdrawal input area is disabled as well
        await waitFor(() => expect(getByTestId("withdrawInput")).toBeDisabled())
    })
})