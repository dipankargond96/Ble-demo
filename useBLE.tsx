/* eslint-disable no-bitwise */
import { useEffect, useState } from 'react';
import { Alert, PermissionsAndroid, Platform } from 'react-native';
import {
    BleError,
    BleManager,
    Characteristic,
    Device,
    ScanMode,
} from 'react-native-ble-plx';
import { PERMISSIONS, requestMultiple } from 'react-native-permissions';
import DeviceInfo from 'react-native-device-info';
import { atob } from 'react-native-quick-base64';

//21  these IDS are for count walking steps 
// const SERVICE_UUID = "0000fee7-0000-1000-8000-00805f9b34fb";
// const CHARACTERISTIC_UUID = "0000fea1-0000-1000-8000-00805f9b34fb";

const UUIDArray = [
    {
        CharIDIndex: "21",
        STATUS: "Worked",
        NAME: "Step counter",
        SERVICE_UUID: "0000fee7-0000-1000-8000-00805f9b34fb",
        CHARACTERISTIC_UUID: "0000fea1-0000-1000-8000-00805f9b34fb",
        TRUE_VAL: "isNotifiable,isReadable"
    },
    {
        CharIDIndex: "22",
        NAME: "",
        SERVICE_UUID: "0000fee7-0000-1000-8000-00805f9b34fb",
        CHARACTERISTIC_UUID: "0000fea2-0000-1000-8000-00805f9b34fb",
        TRUE_VAL: "isIndicatable,isReadable,isWritableWithResponse"
    },
    {
        CharIDIndex: "19",
        NAME: "",
        SERVICE_UUID: "0000fee7-0000-1000-8000-00805f9b34fb",
        CHARACTERISTIC_UUID: "0000fec8-0000-1000-8000-00805f9b34fb",
        TRUE_VAL: "isIndicatable"
    },
    {
        CharIDIndex: "12",
        NAME: "",
        SERVICE_UUID: "0000feea-0000-1000-8000-00805f9b34fb",
        CHARACTERISTIC_UUID: "0000fee3-0000-1000-8000-00805f9b34fb",
        TRUE_VAL: "isNotifiable"
    },
    {
        CharIDIndex: "10",
        NAME: "unKnown",
        SERVICE_UUID: "0000feea-0000-1000-8000-00805f9b34fb",
        CHARACTERISTIC_UUID: "0000fee1-0000-1000-8000-00805f9b34fb",
        TRUE_VAL: "isNotifiable,isReadable"
    },
    {
        CharIDIndex: "9",
        NAME: "Bttery level",
        SERVICE_UUID: "0000180f-0000-1000-8000-00805f9b34fb",
        CHARACTERISTIC_UUID: "00002a19-0000-1000-8000-00805f9b34fb",
        TRUE_VAL: "isNotifiable,isReadable"
    },
    {
        CharIDIndex: "4",
        NAME: "Service Changed",
        SERVICE_UUID: "00001801-0000-1000-8000-00805f9b34fb",
        CHARACTERISTIC_UUID: "00002a05-0000-1000-8000-00805f9b34fb",
        TRUE_VAL: "isIndicatable"
    },
    {
        CharIDIndex: "26",
        NAME: "Heart Rate",
        SERVICE_UUID: "0000180d-0000-1000-8000-00805f9b34fb",
        CHARACTERISTIC_UUID: "00002a37-0000-1000-8000-00805f9b34fb",
        TRUE_VAL: "isNotifiable"
    }
]

//4,9,10,12,19, there is no error for these index value
//0,1,2,3,5,6,7,8,11,13,14,15,17,18,20,  there is an error for there index value
//16
// 21,22 got response from this 

const SERVICE_UUID = '180f';
const CHARACTERISTIC_UUID = '2a19';

const bleManager = new BleManager();

type VoidCallback = (result: boolean) => void;

interface BluetoothLowEnergyApi {
    requestPermissions(cb: VoidCallback): Promise<void>;
    scanForPeripherals(): void;
    connectToDevice: (deviceId: Device) => Promise<void>;
    getServicesAndCharacteristicsData: (serviceId: string, CharacteristicId: string, device: Device) => void;
    disconnectFromDevice: () => void;
    connectedDevice: Device | null;
    allDevices: Device[];
    heartRate: number;
    availableServices: any | null;
}

function useBLE(): BluetoothLowEnergyApi {
    const [allDevices, setAllDevices] = useState<Device[]>([]);
    const [connectedDevice, setConnectedDevice] = useState<Device | null>(null);
    const [heartRate, setHeartRate] = useState<number>(0);
    const [availableServices, setAvailableServices] = useState([]);
    const [serviceArray, setServiceArray] = useState<any>([])


    useEffect(() => {
        console.log({ serviceArray });
    }, [serviceArray])

    const requestPermissions = async (cb: VoidCallback) => {
        if (Platform.OS === 'android') {
            const apiLevel = await DeviceInfo.getApiLevel();
            if (apiLevel < 31) {
                const granted = await PermissionsAndroid.request(
                    PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
                    {
                        title: 'Location Permission',
                        message: 'Bluetooth Low Energy requires Location',
                        buttonNeutral: 'Ask Later',
                        buttonNegative: 'Cancel',
                        buttonPositive: 'OK',
                    },
                );
                cb(granted === PermissionsAndroid.RESULTS.GRANTED);
            } else {
                const result = await requestMultiple([
                    PERMISSIONS.ANDROID.BLUETOOTH_SCAN,
                    PERMISSIONS.ANDROID.BLUETOOTH_CONNECT,
                    PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION,
                ]);

                const isGranted =
                    result['android.permission.BLUETOOTH_CONNECT'] ===
                    PermissionsAndroid.RESULTS.GRANTED &&
                    result['android.permission.BLUETOOTH_SCAN'] ===
                    PermissionsAndroid.RESULTS.GRANTED &&
                    result['android.permission.ACCESS_FINE_LOCATION'] ===
                    PermissionsAndroid.RESULTS.GRANTED;

                cb(isGranted);
            }
        } else {
            cb(true);
        }
    };

    const isDuplicteDevice = (devices: Device[], nextDevice: Device) =>
        devices.findIndex(device => nextDevice.id === device.id) > -1;

    const scanForPeripherals = () =>
        bleManager.startDeviceScan(null, { allowDuplicates: false, scanMode: ScanMode.LowLatency }, (error, device) => {
            if (error) {
                Alert.alert("ERROR", "" + error);
            }
            if (device && device?.name) {
                setAllDevices((prevState: Device[]) => {
                    if (!isDuplicteDevice(prevState, device)) {
                        return [...prevState, device];
                    }
                    return prevState;
                });
            }
        });

    const connectToDevice = async (device: Device) => {
        try {
            const deviceConnection = await bleManager.connectToDevice(device.id);
            setConnectedDevice(deviceConnection);
            const services = await deviceConnection.discoverAllServicesAndCharacteristics();
            const characteristic: any = await getServicesAndCharacteristics(services)
            //startStreamingData(deviceConnection);
            //console.log({ characteristic });
            var descriptorArray: any = [];
            // const char = getCharValue("2QAAsQAACQAA");
            // console.log("THIS IS CUSTOM VALUE  " + char);
            var serviceArr: any = []
            var promises = await characteristic.map(async (item: any, index: number) => {
                const descData = await deviceConnection.readCharacteristicForService(item.serviceUUID, item.uuid);
                // const val = formatCharacteristicValue(descData);
                // console.log("VVVVVVVVVVVVV " + val);
                //serviceArr.push({ ...item, value: descData.value })

                // await getServicesAndCharacteristicsData(item.serviceUUID, item.uuid, deviceConnection);

                // const descData = await deviceConnection.readCharacteristic(item.uuid);


                // console.log("THIS IS CHAR VALUE " + val);

                // const data = await getServicesAndCharacteristicsData(item.serviceUUID, item.uuid);
                // console.log({ index });
                // console.log("****************************************************************");
                // bleManager.descriptorsForDevice(item.deviceID, item.serviceUUID, item.uuid).then(async (descriptor) => {
                //     const desc = descriptor[0];
                //     const descData = await deviceConnection.readCharacteristicForService(item.serviceUUID, item.uuid);
                //     // const descData = await deviceConnection.readCharacteristic(item.uuid);

                //     const val = formatCharacteristicValue(descData);
                //     console.log("THIS IS DESC " + val);
                // })

                // const des = await bleManager.readDescriptorForDevice(item.deviceID, item.serviceUUID, item.uuid, descriptor[index].uuid);
                // //console.log({ des });
                // console.log("VALUE : " + JSON.stringify(des));
                // const val = formatCharacteristicValue(des);
                // descriptorArray.push(descriptor[0])

                // console.log("VALUE : " + descriptor[0].characteristicUUID);
                // console.log({ descriptorArray });
                return { ...item, value: descData.value };
            })

            const finalData: any = await Promise.all(promises);
            setAvailableServices(finalData);
            bleManager.stopDeviceScan();
            //startStreamingData(deviceConnection);
        } catch (e) {
            console.log('FAILED TO CONNECT', e);
        }
    };

    const getServicesAndCharacteristicsData = async (SERVICE_UUID: string, CHARACTERISTIC_UUID: string, deviceConnection: Device) => {
        if (deviceConnection) {
            const response = bleManager.monitorCharacteristicForDevice(deviceConnection.id,
                SERVICE_UUID,
                CHARACTERISTIC_UUID,
                (error, characteristic) => onHeartRateUpdate(error, characteristic),
            );
            return response;
        } else {
            console.log('No Device Connected');
        }
    }

    const getServicesAndCharacteristics = (device: Device) => {
        return new Promise((resolve, reject) => {
            device.services().then(services => {
                const characteristics: Characteristic[][] = []

                services.forEach((service, i) => {
                    // console.log({ service });

                    service.characteristics().then(c => {
                        // console.log({ c });
                        characteristics.push(c)
                        if (i === services.length - 1) {
                            const temp = characteristics.reduce((acc, current) => {
                                return [...acc, ...current]
                            }, [])
                            // console.log({ temp });

                            // console.log("SERVICE : " + JSON.stringify(temp));
                            const dialog = temp.filter(characteristic => characteristic.isReadable && characteristic.isNotifiable)
                            if (!dialog) {
                                reject('No writable characteristic')
                            }
                            resolve(dialog)
                        }
                    })
                })
            })
        })
    }

    const disconnectFromDevice = () => {
        if (connectedDevice) {
            bleManager.cancelDeviceConnection(connectedDevice.id);
            setConnectedDevice(null);
            setHeartRate(0);
        }
    };

    const onHeartRateUpdate = (
        error: BleError | null,
        characteristic: Characteristic | null,
    ) => {
        if (error) {
            console.log("ERROR ON onHeartRateUpdate : " + error);
            return -1;
        } else if (!characteristic?.value) {
            console.log('No Data was recieved');
            return -1;
        }
        // console.log('SUCCESS :: ' + JSON.stringify(characteristic));

        if (characteristic.uuid.includes("00002a19")) {
            // this is for battery
            const rawData = atob(characteristic.value);
            let innerHeartRate: number = -1;
            innerHeartRate = rawData[0].charCodeAt(0);
            //setHeartRate(innerHeartRate);
            //return innerHeartRate
            console.log("THIS IS BATTERY " + innerHeartRate);
            console.log('CHARECTERICTIC UUID ' + characteristic.uuid);
            console.log('CHARECTERICTIC VALUE ' + characteristic.value);
            setServiceArray([...serviceArray, { batteryLevel: innerHeartRate }])
        } else if (characteristic.uuid.includes("0000fee1")) {
            // this is for step counter real steps
            const rawData = atob(characteristic.value);
            console.log({ rawData });
            let innerHeartRate: number = -1;
            const firstBitValue: number = Number(rawData) & 0x01;
            console.log({ firstBitValue });
            if (firstBitValue === 0) {
                innerHeartRate = rawData[0].charCodeAt(0);
                console.log({ innerHeartRate });
            } else {
                innerHeartRate =
                    Number(rawData[1].charCodeAt(0) << 8) +
                    Number(rawData[2].charCodeAt(2));
            }
            console.log("THIS IS REAL STEP " + innerHeartRate);
            console.log('CHARECTERICTIC UUID ' + characteristic.uuid);
            console.log('CHARECTERICTIC VALUE ' + characteristic.value);
            setServiceArray([...serviceArray, { realStep: innerHeartRate }])
            //setHeartRate(innerHeartRate);
            //return innerHeartRate
        } else {
            // this is for step counter max steps
            const rawData = atob(characteristic.value);
            console.log({ rawData });
            let innerHeartRate: number = -1;
            const firstBitValue: number = Number(rawData) & 0x01;
            console.log({ firstBitValue });
            if (firstBitValue === 0) {
                innerHeartRate = rawData[1].charCodeAt(0);
                console.log({ innerHeartRate });
            } else {
                innerHeartRate =
                    Number(rawData[1].charCodeAt(0) << 8) +
                    Number(rawData[2].charCodeAt(2));
            }
            console.log("THIS IS MAX STEP " + innerHeartRate);
            console.log('CHARECTERICTIC UUID ' + characteristic.uuid);
            console.log('CHARECTERICTIC VALUE ' + characteristic.value);
            setServiceArray([...serviceArray, { maxStep: innerHeartRate }])
            //setHeartRate(innerHeartRate);
            //return innerHeartRate
        }
    };

    const getCharValue = (value: any) => {
        const rawData = atob(value);
        console.log({ rawData });
        let innerHeartRate: number = -1;
        const firstBitValue: number = Number(rawData) & 0x01;
        console.log({ firstBitValue });
        if (firstBitValue === 0) {
            innerHeartRate = rawData[0].charCodeAt(0);
            console.log({ innerHeartRate });
        } else {
            innerHeartRate =
                Number(rawData[1].charCodeAt(0) << 8) +
                Number(rawData[2].charCodeAt(2));
        }
        return innerHeartRate;
    }

    const formatCharacteristicValue = (characteristic: any) => {
        if (characteristic.uuid.includes("00002a19")) {
            // this is for battery
            const rawData = atob(characteristic.value);
            let innerHeartRate: number = -1;
            innerHeartRate = rawData[0].charCodeAt(0);
            //setHeartRate(innerHeartRate);
            //return innerHeartRate
            console.log("THIS IS BATTERY " + innerHeartRate);
            console.log('CHARECTERICTIC UUID ' + characteristic.uuid);
            console.log('CHARECTERICTIC VALUE ' + characteristic.value);
            setServiceArray([...serviceArray, { batteryLevel: innerHeartRate }])
            return innerHeartRate
        } else if (characteristic.uuid.includes("0000fee1")) {
            // this is for step counter real steps
            const rawData = atob(characteristic.value);
            console.log({ rawData });
            let innerHeartRate: number = -1;
            const firstBitValue: number = Number(rawData) & 0x01;
            console.log({ firstBitValue });
            if (firstBitValue === 0) {
                innerHeartRate = rawData[0].charCodeAt(0);
                console.log({ innerHeartRate });
            } else {
                innerHeartRate =
                    Number(rawData[1].charCodeAt(0) << 8) +
                    Number(rawData[2].charCodeAt(2));
            }
            console.log("THIS IS REAL STEP " + innerHeartRate);
            console.log('CHARECTERICTIC UUID ' + characteristic.uuid);
            console.log('CHARECTERICTIC VALUE ' + characteristic.value);
            setServiceArray([...serviceArray, { realStep: innerHeartRate }])
            //setHeartRate(innerHeartRate);
            return innerHeartRate
        } else {
            // this is for step counter max steps
            const rawData = atob(characteristic.value);
            console.log({ rawData });
            let innerHeartRate: number = -1;
            const firstBitValue: number = Number(rawData) & 0x01;
            console.log({ firstBitValue });
            if (firstBitValue === 0) {
                innerHeartRate = rawData[1].charCodeAt(0);
                console.log({ innerHeartRate });
            } else {
                innerHeartRate =
                    Number(rawData[1].charCodeAt(0) << 8) +
                    Number(rawData[2].charCodeAt(2));
            }
            console.log("THIS IS MAX STEP " + innerHeartRate);
            console.log('CHARECTERICTIC UUID ' + characteristic.uuid);
            console.log('CHARECTERICTIC VALUE ' + characteristic.value);
            setServiceArray([...serviceArray, { maxStep: innerHeartRate }])
            //setHeartRate(innerHeartRate);
            return innerHeartRate
        }
    }

    const startStreamingData = async (device: Device) => {
        console.log('INSIDE startStreamingData');
        if (device) {
            bleManager.monitorCharacteristicForDevice(device.id,
                SERVICE_UUID,
                CHARACTERISTIC_UUID,
                (error, characteristic) => onHeartRateUpdate(error, characteristic),
            );
        } else {
            console.log('No Device Connected');
        }
    };

    return {
        scanForPeripherals,
        requestPermissions,
        connectToDevice,
        allDevices,
        connectedDevice,
        disconnectFromDevice,
        heartRate,
        availableServices,
        getServicesAndCharacteristicsData
    };
}

export default useBLE;


